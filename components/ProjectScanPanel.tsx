"use client";

import { ApiClientError, apiJson } from "@/lib/api-client";
import { collectScanPrereqMissing } from "@/lib/api/scan-prereq";
import { formatLocalDateTime } from "@/lib/format-date";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

type Props = {
  projectId: string;
  name: string;
  repositoryUrl: string;
  documentationSourceUrl: string;
  openapiAttached: boolean;
  openapiValid: boolean;
  originalFilename: string | null;
  lastScanAt: string | null;
  lastScanResult: string | null;
  lastScanIssueCount: number;
};

export function ProjectScanPanel(props: Props) {
  const router = useRouter();
  const [phase, setPhase] = useState<"idle" | "running" | "done">("idle");
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [summary, setSummary] = useState<{
    result?: string;
    issuesFound?: number;
    completedAt?: string;
    info?: string;
  } | null>(null);

  const missing = useMemo(
    () =>
      collectScanPrereqMissing({
        name: props.name,
        repositoryUrl: props.repositoryUrl,
        documentationSourceUrl: props.documentationSourceUrl,
        openapiAttached: props.openapiAttached,
        openapiValid: props.openapiValid,
      }),
    [props]
  );

  const ready = missing.length === 0;

  const missingLabel: Record<string, string> = {
    name: "Project name is required.",
    repositoryUrl: "Repository URL is required and must be valid.",
    documentationSourceUrl: "Documentation source URL is required and must be valid.",
    openapiValidSpec: "Attach a valid OpenAPI specification before running a scan.",
  };

  async function runScan() {
    setError(null);
    setWarning(null);
    setSummary(null);
    setPhase("running");
    try {
      const res = await apiJson<{
        scanRun: {
          id: string;
          status: string;
          result?: string;
          issuesFound?: number;
          completedAt?: string;
          docFetchWarning?: string;
          info?: string;
        };
      }>(`/api/projects/${props.projectId}/scans`, { method: "POST" });
      setPhase("done");
      setSummary({
        result: res.scanRun.result,
        issuesFound: res.scanRun.issuesFound,
        completedAt: res.scanRun.completedAt,
        info: res.scanRun.info,
      });
      if (res.scanRun.docFetchWarning) {
        setWarning(res.scanRun.docFetchWarning);
      }
      router.refresh();
    } catch (e) {
      setPhase("idle");
      if (e instanceof ApiClientError) {
        if (e.status === 409 && e.body?.error?.code === "SCAN_PREREQ_MISSING") {
          const m = (e.body.error.details?.missing as string[] | undefined) || [];
          setError(m.map((c) => missingLabel[c] || c).join(" "));
          return;
        }
        if (e.status === 409 && e.body?.error?.code === "SCAN_IN_PROGRESS") {
          setError("A scan is already running for this project.");
          return;
        }
      }
      setError(e instanceof Error ? e.message : "Scan failed");
    }
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-sm font-semibold text-slate-900">Run drift scan</h2>
      <p className="mt-1 text-xs text-slate-600">
        Scans run synchronously on the server (see README). Prerequisites must all be satisfied.
      </p>

      <ul className="mt-4 space-y-2 text-sm">
        <li className={!missing.includes("name") ? "text-emerald-700" : "text-slate-600"}>
          {missing.includes("name") ? "○" : "✓"} Project name
        </li>
        <li className={!missing.includes("repositoryUrl") ? "text-emerald-700" : "text-slate-600"}>
          {missing.includes("repositoryUrl") ? "○" : "✓"} Repository URL
        </li>
        <li
          className={
            !missing.includes("documentationSourceUrl") ? "text-emerald-700" : "text-slate-600"
          }
        >
          {missing.includes("documentationSourceUrl") ? "○" : "✓"} Documentation URL
        </li>
        <li className={!missing.includes("openapiValidSpec") ? "text-emerald-700" : "text-slate-600"}>
          {missing.includes("openapiValidSpec") ? "○" : "✓"} Valid OpenAPI attached
        </li>
      </ul>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={!ready || phase === "running"}
          onClick={() => void runScan()}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {phase === "running" ? "Scanning…" : "Run Scan"}
        </button>
        <Link
          href={`/projects/${props.projectId}/issues`}
          className="text-sm font-medium text-slate-700 underline-offset-2 hover:underline"
        >
          View drift results
        </Link>
      </div>

      {error ? (
        <p className="mt-3 text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}
      {warning ? (
        <p className="mt-3 text-sm text-amber-800" role="status">
          {warning}
        </p>
      ) : null}
      {phase === "running" ? (
        <p className="mt-3 text-sm text-slate-600">Running drift rules and optional documentation fetch…</p>
      ) : null}
      {phase === "done" && summary ? (
        <div className="mt-4 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800">
          {summary.result === "no_drift" ? (
            <p>No drift detected for the latest scan.</p>
          ) : summary.result === "drift" ? (
            <p>
              Drift detected. Issues found:{" "}
              <strong>{summary.issuesFound ?? 0}</strong>.{" "}
              <Link className="underline" href={`/projects/${props.projectId}/issues`}>
                Open drift results
              </Link>
            </p>
          ) : (
            <p>Scan finished with errors. Check your OpenAPI or try again.</p>
          )}
          {summary.completedAt ? (
            <p className="mt-1 text-xs text-slate-600">
              Completed {formatLocalDateTime(summary.completedAt)}
            </p>
          ) : null}
          {summary.info ? (
            <p className="mt-2 text-xs text-slate-600">{summary.info}</p>
          ) : null}
        </div>
      ) : null}

      <dl className="mt-6 grid gap-3 border-t border-slate-100 pt-4 text-xs text-slate-600 md:grid-cols-2">
        <div>
          <dt className="font-medium text-slate-500">Last scan</dt>
          <dd>{formatLocalDateTime(props.lastScanAt)}</dd>
        </div>
        <div>
          <dt className="font-medium text-slate-500">Last result</dt>
          <dd>{props.lastScanResult ?? "—"}</dd>
        </div>
        <div>
          <dt className="font-medium text-slate-500">Issues (latest scan)</dt>
          <dd>{props.lastScanIssueCount ?? 0}</dd>
        </div>
      </dl>
    </section>
  );
}
