import { randomUUID } from "crypto";
import { jsonError } from "@/lib/api/errors";
import { collectScanPrereqMissing } from "@/lib/api/scan-prereq";
import { getAppUserId } from "@/lib/auth/app-user";
import {
  ENGINE_VERSION,
  runDriftScan,
  type RunDriftScanOutput,
} from "@/lib/drift/engine";
import { validateOpenApiText } from "@/lib/openapi/validate";
import { isUuid } from "@/lib/validation/project";
import { getPool } from "@/lib/db/pool";
import { NextResponse } from "next/server";

type Ctx = { params: Promise<{ projectId: string }> };

function rpcMessage(err: unknown): string {
  return err instanceof Error ? err.message : "";
}

export async function POST(request: Request, ctx: Ctx) {
  const { projectId } = await ctx.params;
  if (!isUuid(projectId)) {
    return jsonError(404, "NOT_FOUND", "Project not found");
  }

  const userId = await getAppUserId();

  const pool = getPool();
  const projRes = await pool.query(
    `select * from projects where id = $1 and user_id = $2`,
    [projectId, userId]
  );
  const project = projRes.rows[0];
  if (!project) {
    return jsonError(404, "NOT_FOUND", "Project not found");
  }

  const specRes = await pool.query(
    `select * from openapi_specs where project_id = $1`,
    [projectId]
  );
  const spec = specRes.rows[0];

  const missing = collectScanPrereqMissing({
    name: (project as { name: string }).name,
    repositoryUrl: (project as { repository_url: string }).repository_url,
    documentationSourceUrl: (project as { documentation_source_url: string })
      .documentation_source_url,
    openapiAttached: !!spec,
    openapiValid: spec?.validation_status === "valid",
  });

  if (missing.length > 0) {
    return jsonError(409, "SCAN_PREREQ_MISSING", "Missing required configuration", {
      missing,
    });
  }

  const openapiSha = (spec as { content_sha256: string }).content_sha256;
  const rawText = (spec as { raw_spec_text: string }).raw_spec_text;

  const runId = randomUUID();

  try {
    await pool.query(
      `select insert_running_scan($1::uuid, $2::uuid, $3::uuid, $4::text, $5::text)`,
      [userId, projectId, runId, ENGINE_VERSION, openapiSha]
    );
  } catch (e) {
    const msg = rpcMessage(e);
    if (msg.includes("scan_in_progress")) {
      return jsonError(
        409,
        "SCAN_IN_PROGRESS",
        "A scan is already running for this project."
      );
    }
    return jsonError(500, "INTERNAL_ERROR", msg || "Could not start scan");
  }

  const completedAt = () => new Date().toISOString();

  const finalize = async (payload: {
    status: "completed" | "failed";
    result?: "no_drift" | "drift" | "error" | null;
    docFetchStatus: "skipped" | "ok" | "failed";
    docFetchHttpStatus?: number | null;
    docFetchError?: string | null;
    issuesFound: number;
    issues: {
      title: string;
      affected_area: string;
      severity: string;
      status: string;
      reason: string;
      documentation_reference: string;
      rule_id: string;
    }[];
  }) => {
    const pRun = {
      id: runId,
      status: payload.status,
      result: payload.result ?? "",
      startedAt: null,
      completedAt: completedAt(),
      engineVersion: ENGINE_VERSION,
      openapiSha256: openapiSha,
      docFetchStatus: payload.docFetchStatus,
      docFetchHttpStatus:
        payload.docFetchHttpStatus === undefined || payload.docFetchHttpStatus === null
          ? ""
          : String(payload.docFetchHttpStatus),
      docFetchError: payload.docFetchError ?? "",
      issuesFound: String(payload.issuesFound),
    };
    try {
        await pool.query(
          `select finalize_scan_run($1::uuid, $2::uuid, $3::uuid, $4::jsonb, $5::jsonb)`,
          [userId, projectId, runId, pRun, payload.issues]
        );
    } catch (err) {
      console.error("finalize_scan_run", err);
      throw err instanceof Error ? err : new Error("finalize failed");
    }
  };

  try {
    const validated = await validateOpenApiText(rawText);
    if (!validated.ok) {
      await finalize({
        status: "completed",
        result: "error",
        docFetchStatus: "skipped",
        issuesFound: 0,
        issues: [],
      });
      const ts = completedAt();
      return NextResponse.json({
        scanRun: {
          id: runId,
          status: "completed",
          result: "error",
          issuesFound: 0,
          completedAt: ts,
        },
      });
    }

    let engineOut: RunDriftScanOutput;
    try {
      engineOut = await Promise.race([
        runDriftScan(
          {
            repositoryUrl: (project as { repository_url: string }).repository_url,
            documentationSourceUrl: (project as {
              documentation_source_url: string;
            }).documentation_source_url,
            openapi: validated,
          },
          { overallDeadlineMs: 30_000 }
        ),
        new Promise<never>((_, rej) =>
          setTimeout(() => rej(new Error("SCAN_BUDGET")), 30_000)
        ),
      ]);
    } catch (e) {
      if (e instanceof Error && e.message === "SCAN_BUDGET") {
        engineOut = {
          docFetch: {
            status: "skipped",
            httpStatus: null,
            error: null,
            plaintext: null,
          },
          operationsCount: 0,
          issues: [],
          result: "error",
          errorMessage: "Scan processing budget exceeded.",
        };
      } else {
        throw e;
      }
    }

    if (engineOut.result === "error") {
      await finalize({
        status: "completed",
        result: "error",
        docFetchStatus: engineOut.docFetch.status,
        docFetchHttpStatus: engineOut.docFetch.httpStatus,
        docFetchError: engineOut.docFetch.error,
        issuesFound: 0,
        issues: [],
      });
      return NextResponse.json({
        scanRun: {
          id: runId,
          status: "completed",
          result: "error",
          issuesFound: 0,
          completedAt: completedAt(),
        },
      });
    }

    const issuesPayload = engineOut.issues.map((i) => ({
      title: i.title,
      affected_area: i.affected_area,
      severity: i.severity,
      status: i.status,
      reason: i.reason,
      documentation_reference: i.documentation_reference,
      rule_id: i.rule_id,
    }));

    await finalize({
      status: "completed",
      result: engineOut.result,
      docFetchStatus: engineOut.docFetch.status,
      docFetchHttpStatus: engineOut.docFetch.httpStatus,
      docFetchError: engineOut.docFetch.error,
      issuesFound: issuesPayload.length,
      issues: issuesPayload,
    });

    const info =
      engineOut.result === "no_drift" && engineOut.operationsCount === 0
        ? "No operations found in spec."
        : undefined;

    return NextResponse.json({
      scanRun: {
        id: runId,
        status: "completed",
        result: engineOut.result,
        issuesFound: issuesPayload.length,
        completedAt: completedAt(),
        docFetchWarning:
          engineOut.docFetch.status === "failed"
            ? "Could not fetch documentation page; path presence checks skipped."
            : undefined,
        info,
      },
    });
  } catch (e) {
    console.error("scan failed", e);
    try {
      await finalize({
        status: "failed",
        result: null,
        docFetchStatus: "skipped",
        issuesFound: 0,
        issues: [],
      });
    } catch {
      /* ignore */
    }
    return jsonError(500, "INTERNAL_ERROR", "Scan failed unexpectedly.");
  }
}
