import { getAppUserId } from "@/lib/auth/app-user";
import { getPool } from "@/lib/db/pool";
import { SpecAttachClient } from "./spec-client";
import Link from "next/link";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ projectId: string }> };

export default async function SpecPage(props: Props) {
  const { projectId } = await props.params;
  const userId = await getAppUserId();
  const pool = getPool();

  const projRes = await pool.query(
    `select name from projects where id = $1 and user_id = $2`,
    [projectId, userId]
  );
  const project = projRes.rows[0];
  if (!project) notFound();

  const specRes = await pool.query(
    `select validation_status, original_filename, updated_at, validation_errors
     from openapi_specs where project_id = $1`,
    [projectId]
  );
  const spec = specRes.rows[0];

  return (
    <div className="space-y-6">
      <div>
        <Link href={`/projects/${projectId}`} className="text-sm text-slate-600 hover:text-slate-900">
          ← Back to project
        </Link>
        <h1 className="mt-2 text-xl font-semibold text-slate-900">Attach OpenAPI specification</h1>
        <p className="mt-1 text-sm text-slate-600">Project: {project.name as string}</p>
      </div>
      <SpecAttachClient
        projectId={projectId}
        initialSummary={
          spec
            ? {
                attached: true,
                validationStatus: spec.validation_status as "valid" | "invalid",
                originalFilename: spec.original_filename as string | null,
                updatedAt: spec.updated_at as string,
                validationErrors: (spec.validation_errors as { path: string; message: string }[]) || [],
              }
            : null
        }
      />
    </div>
  );
}
