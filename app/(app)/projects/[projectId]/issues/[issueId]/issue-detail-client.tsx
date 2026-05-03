"use client";

import { ApiClientError, apiJson } from "@/lib/api-client";
import { useToast } from "@/components/Toast";
import { formatLocalDateTime } from "@/lib/format-date";
import type { IssueDetail } from "@/lib/types";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

export function IssueDetailClient({
  projectId,
  issueId,
}: {
  projectId: string;
  issueId: string;
}) {
  const params = useSearchParams();
  const toast = useToast();
  const [issue, setIssue] = useState<IssueDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFoundState, setNotFoundState] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [status, setStatus] = useState<string>("Open");
  const [lastGoodStatus, setLastGoodStatus] = useState<string>("Open");
  const [retryTarget, setRetryTarget] = useState<string | null>(null);

  const returnSeverity = params.get("returnSeverity") || "";
  const returnStatus = params.get("returnStatus") || "";

  const backQs = new URLSearchParams();
  if (returnSeverity) backQs.set("severity", returnSeverity);
  if (returnStatus) backQs.set("status", returnStatus);
  const backHrefClean =
    backQs.toString().length > 0
      ? `/projects/${projectId}/issues?${backQs.toString()}`
      : `/projects/${projectId}/issues`;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setNotFoundState(false);
      try {
        const data = await apiJson<{ issue: IssueDetail }>(
          `/api/projects/${projectId}/issues/${issueId}`
        );
        if (cancelled) return;
        setIssue(data.issue);
        setStatus(data.issue.status);
        setLastGoodStatus(data.issue.status);
      } catch (e) {
        if (!cancelled && e instanceof ApiClientError && e.status === 404) {
          setNotFoundState(true);
        } else if (!cancelled) {
          setSaveError(e instanceof Error ? e.message : "Failed to load issue");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId, issueId]);

  async function saveStatus(next: string) {
    setSaveError(null);
    setRetryTarget(null);
    setSaving(true);
    setStatus(next);
    try {
      const data = await apiJson<{ issue: IssueDetail }>(
        `/api/projects/${projectId}/issues/${issueId}`,
        {
          method: "PATCH",
          body: JSON.stringify({ status: next }),
        }
      );
      setIssue(data.issue);
      setLastGoodStatus(data.issue.status);
      setStatus(data.issue.status);
      toast.show("Status saved");
    } catch (e) {
      setRetryTarget(next);
      setStatus(lastGoodStatus);
      setSaveError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="animate-pulse space-y-3">
        <div className="h-6 w-1/3 rounded bg-slate-200" />
        <div className="h-4 w-full rounded bg-slate-200" />
        <div className="h-4 w-5/6 rounded bg-slate-200" />
      </div>
    );
  }

  if (notFoundState || !issue) {
    return (
      <div className="rounded-md border border-slate-200 bg-white p-6 text-sm text-slate-700">
        Issue not found.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <nav className="text-xs text-slate-600">
        <Link href="/" className="hover:underline">
          Projects
        </Link>
        <span className="mx-1">/</span>
        <Link href={`/projects/${projectId}`} className="hover:underline">
          Project
        </Link>
        <span className="mx-1">/</span>
        <Link href={backHrefClean} className="hover:underline">
          Drift results
        </Link>
        <span className="mx-1">/</span>
        <span className="text-slate-900">Issue</span>
      </nav>

      <div>
        <Link
          href={backHrefClean}
          className="text-sm font-medium text-slate-900 underline underline-offset-2"
        >
          Back to drift results
        </Link>
        <h1 className="mt-3 text-xl font-semibold text-slate-900">{issue.title}</h1>
        <p className="mt-1 text-xs text-slate-500">Rule {issue.ruleId}</p>
      </div>

      <section className="grid gap-6 rounded-lg border border-slate-200 bg-white p-6 shadow-sm md:grid-cols-2">
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Affected area
          </h2>
          <p className="mt-1 font-mono text-sm text-slate-900">{issue.affectedArea}</p>
        </div>
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Severity
          </h2>
          <p className="mt-1 text-sm text-slate-900">
            <span className="rounded bg-slate-100 px-2 py-0.5 text-xs">{issue.severity}</span>
          </p>
        </div>
        <div className="md:col-span-2">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Reason</h2>
          <p className="mt-1 text-sm leading-relaxed text-slate-800">{issue.reason}</p>
        </div>
        <div className="md:col-span-2">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Documentation reference
          </h2>
          <a
            className="mt-1 block break-all text-sm text-slate-900 underline"
            href={issue.documentationReference}
          >
            {issue.documentationReference}
          </a>
        </div>
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Detected</h2>
          <p className="mt-1 text-sm text-slate-800">{formatLocalDateTime(issue.detectedAt)}</p>
        </div>
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Status</h2>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <select
              className="rounded-md border border-slate-300 bg-white px-2 py-1 text-sm"
              value={status}
              disabled={saving}
              onChange={(e) => void saveStatus(e.target.value)}
            >
              <option>Open</option>
              <option>Reviewed</option>
              <option>Resolved</option>
            </select>
            {saving ? <span className="text-xs text-slate-500">Saving…</span> : null}
          </div>
          {saveError ? (
            <div className="mt-2 space-y-2">
              <p className="text-sm text-red-600" role="alert">
                {saveError}
              </p>
              <button
                type="button"
                className="text-sm font-medium text-slate-900 underline"
                disabled={!retryTarget}
                onClick={() => {
                  if (retryTarget) void saveStatus(retryTarget);
                }}
              >
                Retry
              </button>
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
