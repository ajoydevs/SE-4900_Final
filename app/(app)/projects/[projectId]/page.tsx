import { ProjectScanPanel } from "@/components/ProjectScanPanel";
import { mapProject } from "@/lib/api/mappers";
import { requireServerSession } from "@/lib/auth/server-session";
import { formatLocalDateTime } from "@/lib/format-date";
import { getPool } from "@/lib/db/pool";
import Link from "next/link";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ projectId: string }> };

export default async function ProjectHomePage(props: Props) {
  const { projectId } = await props.params;
  const user = await requireServerSession();
  const pool = getPool();
  const projRes = await pool.query(
    `select * from projects where id = $1 and user_id = $2`,
    [projectId, user.id]
  );
  const projectRow = projRes.rows[0];
  if (!projectRow) notFound();
  const p = mapProject(projectRow as never);

  const specRes = await pool.query(
    `select validation_status, original_filename, updated_at from openapi_specs
     where project_id = $1`,
    [projectId]
  );
  const spec = specRes.rows[0];

  const openapiAttached = !!spec;
  const openapiValid = spec?.validation_status === "valid";

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href="/" className="text-sm text-slate-600 hover:text-slate-900">
            ← Projects
          </Link>
          <h1 className="mt-2 text-xl font-semibold text-slate-900">{p.name}</h1>
          <p className="mt-1 text-xs text-slate-500">Updated {formatLocalDateTime(p.updatedAt)}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/projects/${projectId}/edit`}
            className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-800 shadow-sm hover:bg-slate-50"
          >
            Edit project
          </Link>
          <Link
            href={`/projects/${projectId}/spec`}
            className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-800 shadow-sm hover:bg-slate-50"
          >
            OpenAPI spec
          </Link>
        </div>
      </div>

      <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900">Sources</h2>
        <dl className="mt-3 space-y-2 text-sm text-slate-700">
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Repository</dt>
            <dd className="truncate">
              <a className="text-slate-900 underline" href={p.repositoryUrl}>
                {p.repositoryUrl}
              </a>
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Documentation</dt>
            <dd className="truncate">
              <a className="text-slate-900 underline" href={p.documentationSourceUrl}>
                {p.documentationSourceUrl}
              </a>
            </dd>
          </div>
        </dl>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900">Attached OpenAPI</h2>
        {openapiAttached ? (
          <dl className="mt-3 text-sm text-slate-700">
            <div>
              <dt className="text-xs font-medium text-slate-500">File / label</dt>
              <dd>{spec?.original_filename || "Pasted spec"}</dd>
            </div>
            <div className="mt-2">
              <dt className="text-xs font-medium text-slate-500">Validation</dt>
              <dd>
                <span
                  className={
                    openapiValid
                      ? "rounded bg-emerald-100 px-2 py-0.5 text-xs text-emerald-900"
                      : "rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-900"
                  }
                >
                  {openapiValid ? "Valid OpenAPI" : "Invalid OpenAPI"}
                </span>
              </dd>
            </div>
            <div className="mt-2 text-xs text-slate-500">
              Last updated {formatLocalDateTime(spec?.updated_at as string | null)}
            </div>
          </dl>
        ) : (
          <p className="mt-2 text-sm text-slate-600">No specification attached yet.</p>
        )}
        <div className="mt-4">
          <Link href={`/projects/${projectId}/spec`} className="text-sm font-medium text-slate-900 underline">
            Attach or replace spec
          </Link>
        </div>
      </section>

      <ProjectScanPanel
        projectId={projectId}
        name={p.name}
        repositoryUrl={p.repositoryUrl}
        documentationSourceUrl={p.documentationSourceUrl}
        openapiAttached={openapiAttached}
        openapiValid={openapiValid}
        originalFilename={(spec?.original_filename as string | null) ?? null}
        lastScanAt={p.lastScanAt}
        lastScanResult={p.lastScanResult}
        lastScanIssueCount={p.lastScanIssueCount ?? 0}
      />
    </div>
  );
}
