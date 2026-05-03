import { jsonError } from "@/lib/api/errors";
import { mapProject } from "@/lib/api/mappers";
import { getRouteSupabase } from "@/lib/api/supabase-route";
import { isUuid, validateProjectInput } from "@/lib/validation/project";
import { NextResponse } from "next/server";

type Ctx = { params: Promise<{ projectId: string }> };

export async function GET(request: Request, ctx: Ctx) {
  const { projectId } = await ctx.params;
  if (!isUuid(projectId)) {
    return jsonError(404, "NOT_FOUND", "Project not found");
  }

  const { supabase, user } = await getRouteSupabase(request);
  if (!user) {
    return jsonError(401, "UNAUTHORIZED", "Authentication required");
  }

  const { data: project, error: pErr } = await supabase
    .from("projects")
    .select("*")
    .eq("id", projectId)
    .maybeSingle();

  if (pErr || !project) {
    return jsonError(404, "NOT_FOUND", "Project not found");
  }

  const { data: spec } = await supabase
    .from("openapi_specs")
    .select("validation_status, original_filename, updated_at")
    .eq("project_id", projectId)
    .maybeSingle();

  const openapi = spec
    ? {
        attached: true,
        originalFilename: spec.original_filename as string | null,
        validationStatus: spec.validation_status as "valid" | "invalid",
        updatedAt: spec.updated_at as string,
      }
    : {
        attached: false,
        originalFilename: null,
        validationStatus: "invalid" as const,
        updatedAt: null as string | null,
      };

  return NextResponse.json({
    project: {
      ...mapProject(project as never),
      openapi,
    },
  });
}

export async function PATCH(request: Request, ctx: Ctx) {
  const { projectId } = await ctx.params;
  if (!isUuid(projectId)) {
    return jsonError(404, "NOT_FOUND", "Project not found");
  }

  const { supabase, user } = await getRouteSupabase(request);
  if (!user) {
    return jsonError(401, "UNAUTHORIZED", "Authentication required");
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(422, "VALIDATION_ERROR", "Invalid JSON body");
  }

  const b = body as Record<string, unknown>;
  const patch: Record<string, string> = {};
  if ("name" in b) patch.name = String(b.name ?? "");
  if ("repositoryUrl" in b) patch.repositoryUrl = String(b.repositoryUrl ?? "");
  if ("documentationSourceUrl" in b)
    patch.documentationSourceUrl = String(b.documentationSourceUrl ?? "");

  const { data: existing, error: exErr } = await supabase
    .from("projects")
    .select("*")
    .eq("id", projectId)
    .maybeSingle();
  if (exErr || !existing) {
    return jsonError(404, "NOT_FOUND", "Project not found");
  }

  const merged = {
    name: "name" in patch ? patch.name : (existing as { name: string }).name,
    repositoryUrl:
      "repositoryUrl" in patch
        ? patch.repositoryUrl
        : (existing as { repository_url: string }).repository_url,
    documentationSourceUrl:
      "documentationSourceUrl" in patch
        ? patch.documentationSourceUrl
        : (existing as { documentation_source_url: string })
            .documentation_source_url,
  };

  const v = validateProjectInput({
    name: merged.name,
    repositoryUrl: merged.repositoryUrl,
    documentationSourceUrl: merged.documentationSourceUrl,
  });
  if (!v.ok) {
    return jsonError(422, "VALIDATION_ERROR", "Validation failed", {
      fields: v.errors,
    });
  }

  const { data, error } = await supabase
    .from("projects")
    .update({
      name: v.name,
      repository_url: v.repositoryUrl,
      documentation_source_url: v.documentationSourceUrl,
    })
    .eq("id", projectId)
    .select("*")
    .single();

  if (error || !data) {
    return jsonError(500, "INTERNAL_ERROR", error?.message || "Update failed");
  }

  const { data: spec } = await supabase
    .from("openapi_specs")
    .select("validation_status, original_filename, updated_at")
    .eq("project_id", projectId)
    .maybeSingle();

  const openapi = spec
    ? {
        attached: true,
        originalFilename: spec.original_filename as string | null,
        validationStatus: spec.validation_status as "valid" | "invalid",
        updatedAt: spec.updated_at as string,
      }
    : {
        attached: false,
        originalFilename: null,
        validationStatus: "invalid" as const,
        updatedAt: null as string | null,
      };

  return NextResponse.json({
    project: {
      ...mapProject(data as never),
      openapi,
    },
  });
}
