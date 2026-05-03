import { jsonError } from "@/lib/api/errors";
import { mapProject } from "@/lib/api/mappers";
import { getRouteSupabase } from "@/lib/api/supabase-route";
import { validateProjectInput } from "@/lib/validation/project";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { supabase, user } = await getRouteSupabase(request);
  if (!user) {
    return jsonError(401, "UNAUTHORIZED", "Authentication required");
  }

  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    return jsonError(500, "INTERNAL_ERROR", error.message);
  }

  return NextResponse.json({
    projects: (data || []).map((row) => mapProject(row as never)),
  });
}

export async function POST(request: Request) {
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
  const v = validateProjectInput({
    name: b.name,
    repositoryUrl: b.repositoryUrl,
    documentationSourceUrl: b.documentationSourceUrl,
  });
  if (!v.ok) {
    return jsonError(422, "VALIDATION_ERROR", "Validation failed", {
      fields: v.errors,
    });
  }

  const { data, error } = await supabase
    .from("projects")
    .insert({
      user_id: user.id,
      name: v.name,
      repository_url: v.repositoryUrl,
      documentation_source_url: v.documentationSourceUrl,
    })
    .select("*")
    .single();

  if (error) {
    return jsonError(500, "INTERNAL_ERROR", error.message);
  }

  return NextResponse.json({ project: mapProject(data as never) }, { status: 201 });
}
