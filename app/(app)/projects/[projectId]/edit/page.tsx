import { ProjectForm } from "@/components/ProjectForm";
import { mapProject } from "@/lib/api/mappers";
import { requireServerSession } from "@/lib/auth/server-session";
import { getPool } from "@/lib/db/pool";
import Link from "next/link";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ projectId: string }> };

export default async function EditProjectPage(props: Props) {
  const { projectId } = await props.params;
  const user = await requireServerSession();
  const pool = getPool();
  const { rows } = await pool.query(
    `select * from projects where id = $1 and user_id = $2`,
    [projectId, user.id]
  );
  const data = rows[0];
  if (!data) notFound();
  const p = mapProject(data as never);

  return (
    <div className="space-y-6">
      <div>
        <Link href={`/projects/${projectId}`} className="text-sm text-slate-600 hover:text-slate-900">
          ← Back to project
        </Link>
        <h1 className="mt-2 text-xl font-semibold text-slate-900">Edit project</h1>
      </div>
      <ProjectForm
        mode="edit"
        projectId={projectId}
        initial={{
          name: p.name,
          repositoryUrl: p.repositoryUrl,
          documentationSourceUrl: p.documentationSourceUrl,
        }}
      />
    </div>
  );
}
