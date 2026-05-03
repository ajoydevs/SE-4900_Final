import { jsonError } from "@/lib/api/errors";
import { getLatestCompletedScanId } from "@/lib/api/latest-scan";
import { getRouteSupabase } from "@/lib/api/supabase-route";
import { isUuid } from "@/lib/validation/project";
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

  const { data: project } = await supabase
    .from("projects")
    .select("id")
    .eq("id", projectId)
    .maybeSingle();
  if (!project) {
    return jsonError(404, "NOT_FOUND", "Project not found");
  }

  const latestId = await getLatestCompletedScanId(supabase, projectId);
  if (!latestId) {
    const url = new URL(request.url);
    const severity = url.searchParams.get("severity");
    const status = url.searchParams.get("status");
    return NextResponse.json({
      issues: [],
      filters: { severity, status },
      totalCount: 0,
    });
  }

  const { data: rows, error } = await supabase
    .from("drift_issues")
    .select(
      "id, title, affected_area, severity, status, detected_at, scan_run_id"
    )
    .eq("project_id", projectId)
    .eq("scan_run_id", latestId)
    .order("detected_at", { ascending: false });

  if (error) {
    return jsonError(500, "INTERNAL_ERROR", error.message);
  }

  const url = new URL(request.url);
  const severity = url.searchParams.get("severity");
  const status = url.searchParams.get("status");

  const issues = (rows || []).map((r) => ({
    id: r.id as string,
    title: r.title as string,
    affectedArea: r.affected_area as string,
    severity: r.severity as string,
    status: r.status as string,
    detectedAt: r.detected_at as string,
    scanRunId: r.scan_run_id as string,
  }));

  return NextResponse.json({
    issues,
    filters: { severity, status },
    totalCount: issues.length,
  });
}
