import { createServerSupabase } from "@/lib/supabase/server";
import { SpecAttachClient } from "./spec-client";
import Link from "next/link";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ projectId: string }> };

export default async function SpecPage(props: Props) {
  const { projectId } = await props.params;
  const supabase = await createServerSupabase();
  const { data: project } = await supabase
    .from("projects")
    .select("name")
    .eq("id", projectId)
    .maybeSingle();
  if (!project) notFound();

  const { data: spec } = await supabase
    .from("openapi_specs")
    .select("validation_status, original_filename, updated_at, validation_errors")
    .eq("project_id", projectId)
    .maybeSingle();

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
