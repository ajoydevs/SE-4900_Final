-- DocSync MVP schema for plain PostgreSQL (local dev).
-- Replaces Supabase auth.users + RLS with public.users and application-enforced ownership.

create extension if not exists "pgcrypto";

-- Enums
do $$ begin
  create type drift_severity as enum ('High', 'Medium', 'Low');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type drift_status as enum ('Open', 'Reviewed', 'Resolved');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type scan_run_status as enum ('pending', 'running', 'completed', 'failed');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type scan_run_result as enum ('no_drift', 'drift', 'error');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type openapi_validation_status as enum ('valid', 'invalid');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type doc_fetch_status as enum ('skipped', 'ok', 'failed');
exception when duplicate_object then null;
end $$;

create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  password_hash text not null,
  created_at timestamptz not null default now()
);

create index if not exists users_email_lower on public.users (lower(email));

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  name text not null,
  repository_url text not null,
  documentation_source_url text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_scan_at timestamptz,
  last_scan_result scan_run_result,
  last_scan_issue_count int
);

create table if not exists public.openapi_specs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null unique references public.projects (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  raw_spec_text text not null,
  original_filename text,
  format text not null check (format in ('yaml', 'json')),
  validation_status openapi_validation_status not null,
  validation_errors jsonb,
  content_sha256 text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.scan_runs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  status scan_run_status not null,
  result scan_run_result,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  engine_version text not null,
  openapi_sha256 text not null,
  doc_fetch_status doc_fetch_status not null,
  doc_fetch_http_status int,
  doc_fetch_error text,
  issues_found int not null default 0
);

create index if not exists scan_runs_project_started_desc on public.scan_runs (project_id, started_at desc);

create table if not exists public.drift_issues (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  scan_run_id uuid not null references public.scan_runs (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  title text not null,
  affected_area text not null,
  severity drift_severity not null,
  status drift_status not null default 'Open',
  reason text not null,
  documentation_reference text not null,
  detected_at timestamptz not null default now(),
  rule_id text not null
);

create index if not exists drift_issues_project_scan on public.drift_issues (project_id, scan_run_id);
create index if not exists drift_issues_project_status on public.drift_issues (project_id, status);

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists projects_set_updated_at on public.projects;
create trigger projects_set_updated_at
before update on public.projects
for each row execute function public.set_updated_at();

drop trigger if exists openapi_specs_set_updated_at on public.openapi_specs;
create trigger openapi_specs_set_updated_at
before update on public.openapi_specs
for each row execute function public.set_updated_at();

create or replace function public.insert_running_scan(
  p_user_id uuid,
  p_project_id uuid,
  p_run_id uuid,
  p_engine_version text,
  p_openapi_sha256 text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid;
begin
  if p_user_id is null then
    raise exception 'not authenticated';
  end if;

  select user_id into v_owner from projects where id = p_project_id;
  if v_owner is null then
    raise exception 'not_found';
  end if;
  if v_owner <> p_user_id then
    raise exception 'forbidden';
  end if;

  if exists (
    select 1 from scan_runs sr
    where sr.project_id = p_project_id and sr.status = 'running'
  ) then
    raise exception 'scan_in_progress';
  end if;

  insert into scan_runs (
    id, project_id, user_id, status, result, started_at, completed_at,
    engine_version, openapi_sha256, doc_fetch_status, doc_fetch_http_status, doc_fetch_error, issues_found
  ) values (
    p_run_id,
    p_project_id,
    p_user_id,
    'running',
    null,
    now(),
    null,
    p_engine_version,
    p_openapi_sha256,
    'skipped',
    null,
    null,
    0
  );
end;
$$;

create or replace function public.finalize_scan_run(
  p_user_id uuid,
  p_project_id uuid,
  p_run_id uuid,
  p_run jsonb,
  p_issues jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status scan_run_status;
begin
  if p_user_id is null then
    raise exception 'not authenticated';
  end if;

  if not exists (
    select 1 from scan_runs sr
    where sr.id = p_run_id
      and sr.project_id = p_project_id
      and sr.user_id = p_user_id
      and sr.status = 'running'
  ) then
    raise exception 'invalid_scan_run';
  end if;

  v_status := (p_run->>'status')::scan_run_status;

  update scan_runs set
    status = v_status,
    result = nullif(p_run->>'result', '')::scan_run_result,
    completed_at = coalesce(nullif(p_run->>'completedAt', '')::timestamptz, now()),
    doc_fetch_status = (p_run->>'docFetchStatus')::doc_fetch_status,
    doc_fetch_http_status = nullif(p_run->>'docFetchHttpStatus', '')::int,
    doc_fetch_error = nullif(p_run->>'docFetchError', ''),
    issues_found = coalesce(nullif(p_run->>'issuesFound', '')::int, 0)
  where id = p_run_id;

  if p_issues is not null and jsonb_typeof(p_issues) = 'array' and jsonb_array_length(p_issues) > 0 then
    insert into drift_issues (
      project_id, scan_run_id, user_id, title, affected_area, severity, status, reason, documentation_reference, rule_id
    )
    select
      p_project_id,
      p_run_id,
      p_user_id,
      x.title,
      x.affected_area,
      x.severity::drift_severity,
      coalesce(nullif(x.status, '')::drift_status, 'Open'::drift_status),
      x.reason,
      x.documentation_reference,
      x.rule_id
    from jsonb_to_recordset(p_issues) as x(
      title text,
      affected_area text,
      severity text,
      status text,
      reason text,
      documentation_reference text,
      rule_id text
    );
  end if;

  if v_status = 'completed' then
    update projects set
      last_scan_at = coalesce(nullif(p_run->>'completedAt', '')::timestamptz, now()),
      last_scan_result = nullif(p_run->>'result', '')::scan_run_result,
      last_scan_issue_count = coalesce(nullif(p_run->>'issuesFound', '')::int, 0),
      updated_at = now()
    where id = p_project_id;
  elsif v_status = 'failed' then
    update projects set
      last_scan_at = coalesce(nullif(p_run->>'completedAt', '')::timestamptz, now()),
      last_scan_result = 'error'::scan_run_result,
      last_scan_issue_count = 0,
      updated_at = now()
    where id = p_project_id;
  end if;
end;
$$;

grant execute on function public.insert_running_scan(uuid, uuid, uuid, text, text) to PUBLIC;
grant execute on function public.finalize_scan_run(uuid, uuid, uuid, jsonb, jsonb) to PUBLIC;
