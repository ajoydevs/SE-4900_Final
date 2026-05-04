import { jsonError } from "@/lib/api/errors";
import { getLatestCompletedScanId } from "@/lib/api/latest-scan";
import { getAppUserId } from "@/lib/auth/app-user";
import { isUuid } from "@/lib/validation/project";
import { getPool } from "@/lib/db/pool";
import { NextResponse } from "next/server";

type Ctx = { params: Promise<{ projectId: string; issueId: string }> };

const STATUSES = new Set(["Open", "Reviewed", "Resolved"]);

export async function GET(request: Request, ctx: Ctx) {
  const { projectId, issueId } = await ctx.params;
  if (!isUuid(projectId) || !isUuid(issueId)) {
    return jsonError(404, "NOT_FOUND", "Issue not found");
  }

  const userId = await getAppUserId();

  const pool = getPool();
  const projRes = await pool.query(
    `select id from projects where id = $1 and user_id = $2`,
    [projectId, userId]
  );
  if (!projRes.rows[0]) {
    return jsonError(404, "NOT_FOUND", "Issue not found");
  }

  const latestId = await getLatestCompletedScanId(pool, projectId);

  const { rows } = await pool.query(
    `select * from drift_issues where id = $1 and project_id = $2`,
    [issueId, projectId]
  );
  const row = rows[0];
  if (!row) {
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

  const userId = await getAppUserId();

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

  const pool = getPool();
  const projRes = await pool.query(
    `select id from projects where id = $1 and user_id = $2`,
    [projectId, userId]
  );
  if (!projRes.rows[0]) {
    return jsonError(404, "NOT_FOUND", "Issue not found");
  }

  const latestId = await getLatestCompletedScanId(pool, projectId);

  const existingRes = await pool.query(
    `select * from drift_issues where id = $1 and project_id = $2`,
    [issueId, projectId]
  );
  const existing = existingRes.rows[0];
  if (!existing) {
    return jsonError(404, "NOT_FOUND", "Issue not found");
  }
  if (!latestId || existing.scan_run_id !== latestId) {
    return jsonError(404, "NOT_FOUND", "Issue not found");
  }

  const upd = await pool.query(
    `update drift_issues set status = $3::drift_status
     where id = $1 and project_id = $2
     returning *`,
    [issueId, projectId, status]
  );

  const row = upd.rows[0];
  if (!row) {
    return jsonError(500, "INTERNAL_ERROR", "Update failed");
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
