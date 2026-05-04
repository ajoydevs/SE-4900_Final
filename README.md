# DocSync MVP

Next.js (App Router) + TypeScript + Supabase Postgres implementation of the DocSync MVP specification pack in the repository `spec/` folder (read order starts at `spec/15-decisions-assumptions.md`).

UI reference exports live next to this app at [`../visily/`](../visily/) (for example `visily-projects-dashboard.jpg`).

## Prerequisites

- Node.js 20+
- A Supabase project (Postgres + Auth)

## Environment variables

Copy the example file and fill in values locally (never commit real secrets):

```bash
cp .env.example .env.local
```

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL (Settings → API / Connect → Project URL). |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | **Preferred:** new publishable key (`sb_publishable_…`, Settings → API Keys). Same role as legacy anon: safe in the client with RLS. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | **Alternative:** legacy `anon` JWT from “Legacy anon, service_role API keys”. Use if you do not use a publishable key. If both publishable and anon are set, **publishable wins**. |
| `SUPABASE_SERVICE_ROLE_KEY` | Optional for this codebase. The MVP uses the authenticated user session for all data access. Leave blank unless you extend the app with privileged jobs. Never use the secret / `service_role` key in `NEXT_PUBLIC_*`. |

### Auth redirect URL

In Supabase **Authentication → URL configuration**, add your local site URL and redirect:

- Site URL: `http://localhost:3000` (or your deployed origin)
- Additional redirect URLs: `http://localhost:3000/auth/callback`

In **Authentication → Providers → Email**, enable the **Email** provider. Turn on **Magic link** (or “Email OTP”) if you want passwordless sign-in, and ensure **Email / password** (or “Allow users to sign up with email and password”) is enabled if you use the **Email & password** tab on the login page. Confirm **Site URL** and redirect URLs above match your deployment.

## Database schema and RLS

1. Open the Supabase SQL editor (or use the Supabase CLI with linked project).
2. Run the migration script:

[`supabase/migrations/001_init.sql`](supabase/migrations/001_init.sql)

This creates enums, tables (`projects`, `openapi_specs`, `scan_runs`, `drift_issues`), indexes, `updated_at` triggers, row level security policies, and RPC helpers:

- `insert_running_scan` — inserts a `running` scan row and enforces the “no concurrent scans” guard.
- `finalize_scan_run` — completes the scan row, inserts drift issues, and updates denormalized project fields in one transaction.

### Latest-scan-only issues

The issues list and issue detail APIs only surface rows tied to the **latest completed** successful scan (`status = completed`, `result in (drift, no_drift)`), matching `spec/09-data-model.md`. Older `scan_runs` rows remain for history; their issues are not shown in the default list.

## Drift engine

- Version string stored on each run: `drift-engine@1.0.0` (`spec/11-scan-engine-spec.md`).
- Rules implemented: **R1–R4**, plus **R3** for OpenAPI 3.x only (Swagger 2.0 skips R3). **R5** is not implemented (optional in the spec).
- Documentation fetch uses a **10s** timeout and does **not** fail the entire scan on failure (`spec/14-edge-cases.md`).
- OpenAPI parse/validate uses a **3s** watchdog (`spec/14-edge-cases.md`).
- Overall scan work is bounded by a **30s** client-side race in the API route (returns `error` result if exceeded).

## Scan execution model

`POST /api/projects/:id/scans` runs **synchronously** and returns **HTTP 200** with a completed `scanRun` payload when finished (`spec/10-api-and-server-actions.md` synchronous MVP alternative). The UI still shows a blocking “scanning” state until the request completes.

## Security note

`documentation_source_url` is user-controlled. The MVP only allows `http`/`https` URLs at validation time; be aware of SSRF considerations in production deployments (`spec/14-edge-cases.md`).

## Commands

```bash
npm install
npm run dev
```

Other scripts: `npm run build`, `npm start`, `npm run lint`.

## Product scope guardrails

Do not ship required user paths for items listed in `spec/05-out-of-scope.md` (notifications inbox, GitHub OAuth as a requirement, continuous monitoring as a Must, and so on).
