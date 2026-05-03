import { randomUUID } from "crypto";
import { jsonError } from "@/lib/api/errors";
import { collectScanPrereqMissing } from "@/lib/api/scan-prereq";
import { getRouteSupabase } from "@/lib/api/supabase-route";
import {
  ENGINE_VERSION,
  runDriftScan,
  type RunDriftScanOutput,
} from "@/lib/drift/engine";
import { validateOpenApiText } from "@/lib/openapi/validate";
import { isUuid } from "@/lib/validation/project";
import { NextResponse } from "next/server";

type Ctx = { params: Promise<{ projectId: string }> };

function rpcMessage(err: { message?: string } | null): string {
  return err?.message || "";
}

export async function POST(request: Request, ctx: Ctx) {
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
    .select("*")
    .eq("project_id", projectId)
    .maybeSingle();

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
  const { error: startErr } = await supabase.rpc("insert_running_scan", {
    p_project_id: projectId,
    p_run_id: runId,
    p_engine_version: ENGINE_VERSION,
    p_openapi_sha256: openapiSha,
  });

  if (startErr) {
    const msg = rpcMessage(startErr);
    if (msg.includes("scan_in_progress")) {
      return jsonError(409, "SCAN_IN_PROGRESS", "A scan is already running for this project.");
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
    const { error: finErr } = await supabase.rpc("finalize_scan_run", {
      p_project_id: projectId,
      p_run_id: runId,
      p_run: pRun,
      p_issues: payload.issues,
    });
    if (finErr) {
      console.error("finalize_scan_run", finErr);
      throw new Error(finErr.message);
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
