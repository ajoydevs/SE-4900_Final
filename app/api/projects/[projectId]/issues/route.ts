import { jsonError } from "@/lib/api/errors";
import { getLatestCompletedScanId } from "@/lib/api/latest-scan";
import { getAppUserId } from "@/lib/auth/app-user";
import { isUuid } from "@/lib/validation/project";
import { getPool } from "@/lib/db/pool";
import { NextResponse } from "next/server";

type Ctx = { params: Promise<{ projectId: string }> };

export async function GET(request: Request, ctx: Ctx) {
  const { projectId } = await ctx.params;
  if (!isUuid(projectId)) {
    return jsonError(404, "NOT_FOUND", "Project not found");
  }

  const userId = await getAppUserId();

  const pool = getPool();
  const projRes = await pool.query(
    `select id from projects where id = $1 and user_id = $2`,
    [projectId, userId]
  );
  if (!projRes.rows[0]) {
    return jsonError(404, "NOT_FOUND", "Project not found");
  }

  const latestId = await getLatestCompletedScanId(pool, projectId);
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

  const { rows } = await pool.query(
    `select id, title, affected_area, severity, status, detected_at, scan_run_id
     from drift_issues
     where project_id = $1 and scan_run_id = $2
     order by detected_at desc`,
    [projectId, latestId]
  );

  const url = new URL(request.url);
  const severity = url.searchParams.get("severity");
  const status = url.searchParams.get("status");

  const issues = rows.map((r) => ({
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
