import { mapProject } from "@/lib/api/mappers";
import { requireServerSession } from "@/lib/auth/server-session";
import { formatLocalDateTime } from "@/lib/format-date";
import { getPool } from "@/lib/db/pool";
import type { ProjectListItem } from "@/lib/types";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await requireServerSession();
  const pool = getPool();
  const { rows } = await pool.query(
    `select * from projects where user_id = $1 order by created_at desc`,
    [user.id]
  );

  const projects: ProjectListItem[] = rows.map((r) => mapProject(r as never));

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Projects</h1>
          <p className="mt-1 text-sm text-slate-600">
            Tracked repositories and documentation sources. UI reference images live in{" "}
            <code className="rounded bg-slate-100 px-1 text-xs">../visily/</code> relative to this app.
          </p>
        </div>
        <Link
          href="/projects/new"
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow hover:bg-slate-800"
        >
          Add Project
        </Link>
      </div>

      {projects.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-600">
          <p>No projects yet.</p>
          <p className="mt-2">
            <Link href="/projects/new" className="font-medium text-slate-900 underline">
              Create your first project
            </Link>
          </p>
        </div>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {projects.map((p) => (
            <li key={p.id}>
              <Link
                href={`/projects/${p.id}`}
                className="block rounded-lg border border-slate-200 bg-white p-5 shadow-sm transition hover:border-slate-300"
              >
                <h2 className="text-sm font-semibold text-slate-900">{p.name}</h2>
                <dl className="mt-3 space-y-2 text-xs text-slate-600">
                  <div>
                    <dt className="font-medium text-slate-500">Repository</dt>
                    <dd className="truncate">{p.repositoryUrl}</dd>
                  </div>
                  <div>
                    <dt className="font-medium text-slate-500">Documentation</dt>
                    <dd className="truncate">{p.documentationSourceUrl}</dd>
                  </div>
                  <div className="flex flex-wrap gap-4 pt-1">
                    <div>
                      <dt className="font-medium text-slate-500">Latest scan</dt>
                      <dd>{formatLocalDateTime(p.lastScanAt)}</dd>
                    </div>
                    <div>
                      <dt className="font-medium text-slate-500">Drift issues (latest scan)</dt>
                      <dd>{p.lastScanIssueCount ?? 0}</dd>
                    </div>
                  </div>
                </dl>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
