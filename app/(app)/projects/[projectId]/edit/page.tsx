import { ProjectForm } from "@/components/ProjectForm";
import { mapProject } from "@/lib/api/mappers";
import { createServerSupabase } from "@/lib/supabase/server";
import Link from "next/link";
import { notFound } from "next/navigation";

type Props = { params: Promise<{ projectId: string }> };

export default async function EditProjectPage(props: Props) {
  const { projectId } = await props.params;
  const supabase = await createServerSupabase();
  const { data } = await supabase.from("projects").select("*").eq("id", projectId).maybeSingle();
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
