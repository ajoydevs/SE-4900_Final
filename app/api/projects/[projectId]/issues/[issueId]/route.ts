import { jsonError } from "@/lib/api/errors";
import { getLatestCompletedScanId } from "@/lib/api/latest-scan";
import { getRouteSupabase } from "@/lib/api/supabase-route";
import { isUuid } from "@/lib/validation/project";
import { NextResponse } from "next/server";

type Ctx = { params: Promise<{ projectId: string; issueId: string }> };

const STATUSES = new Set(["Open", "Reviewed", "Resolved"]);

export async function GET(request: Request, ctx: Ctx) {
  const { projectId, issueId } = await ctx.params;
  if (!isUuid(projectId) || !isUuid(issueId)) {
    return jsonError(404, "NOT_FOUND", "Issue not found");
  }

  const { supabase, user } = await getRouteSupabase(request);
  if (!user) {
    return jsonError(401, "UNAUTHORIZED", "Authentication required");
  }

  const { data: project } = await supabase
    .from("projects")
    .select("id")
    .eq("id", projectId)
    .maybeSingle();
  if (!project) {
    return jsonError(404, "NOT_FOUND", "Issue not found");
  }

  const latestId = await getLatestCompletedScanId(supabase, projectId);

  const { data: row, error } = await supabase
    .from("drift_issues")
    .select("*")
    .eq("id", issueId)
    .eq("project_id", projectId)
    .maybeSingle();

  if (error || !row) {
    return jsonError(404, "NOT_FOUND", "Issue not found");
  }

  if (!latestId || row.scan_run_id !== latestId) {
    return jsonError(404, "NOT_FOUND", "Issue not found");
  }

  return NextResponse.json({
    issue: {
      id: row.id as string,
      title: row.title as string,
      affectedArea: row.affected_area as string,
      severity: row.severity as string,
      status: row.status as string,
      reason: row.reason as string,
      documentationReference: row.documentation_reference as string,
      detectedAt: row.detected_at as string,
      scanRunId: row.scan_run_id as string,
      ruleId: row.rule_id as string,
    },
  });
}

export async function PATCH(request: Request, ctx: Ctx) {
  const { projectId, issueId } = await ctx.params;
  if (!isUuid(projectId) || !isUuid(issueId)) {
    return jsonError(404, "NOT_FOUND", "Issue not found");
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
  const status = (body as { status?: unknown }).status;
  if (typeof status !== "string" || !STATUSES.has(status)) {
    return jsonError(422, "VALIDATION_ERROR", "Invalid status", {
      allowed: ["Open", "Reviewed", "Resolved"],
    });
  }

  const latestId = await getLatestCompletedScanId(supabase, projectId);

  const { data: existing } = await supabase
    .from("drift_issues")
    .select("*")
    .eq("id", issueId)
    .eq("project_id", projectId)
    .maybeSingle();

  if (!existing) {
    return jsonError(404, "NOT_FOUND", "Issue not found");
  }
  if (!latestId || existing.scan_run_id !== latestId) {
    return jsonError(404, "NOT_FOUND", "Issue not found");
  }

  const { data: row, error } = await supabase
    .from("drift_issues")
    .update({ status })
    .eq("id", issueId)
    .eq("project_id", projectId)
    .select("*")
    .single();

  if (error || !row) {
    return jsonError(500, "INTERNAL_ERROR", error?.message || "Update failed");
  }

  return NextResponse.json({
    issue: {
      id: row.id as string,
      title: row.title as string,
      affectedArea: row.affected_area as string,
      severity: row.severity as string,
      status: row.status as string,
      reason: row.reason as string,
      documentationReference: row.documentation_reference as string,
      detectedAt: row.detected_at as string,
      scanRunId: row.scan_run_id as string,
      ruleId: row.rule_id as string,
    },
  });
}
