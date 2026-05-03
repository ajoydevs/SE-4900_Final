"use client";

import { apiJson } from "@/lib/api-client";
import { formatLocalDateTime } from "@/lib/format-date";
import type { IssueRow } from "@/lib/types";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

const SEVERITIES = ["High", "Medium", "Low"] as const;
const STATUSES = ["Open", "Reviewed", "Resolved"] as const;

export function IssuesClient({ projectId }: { projectId: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [issues, setIssues] = useState<IssueRow[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const severity = searchParams.get("severity") || "";
  const status = searchParams.get("status") || "";

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await apiJson<{
          issues: IssueRow[];
          totalCount: number;
        }>(`/api/projects/${projectId}/issues`);
        if (cancelled) return;
        setIssues(data.issues);
        setTotalCount(data.totalCount);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load issues");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const visible = useMemo(() => {
    return issues.filter((i) => {
      if (severity && i.severity !== severity) return false;
      if (status && i.status !== status) return false;
      return true;
    });
  }, [issues, severity, status]);

  function setFilter(next: { severity?: string; status?: string }) {
    const params = new URLSearchParams(searchParams.toString());
    const sev = next.severity !== undefined ? next.severity : severity;
    const st = next.status !== undefined ? next.status : status;
    if (sev) params.set("severity", sev);
    else params.delete("severity");
    if (st) params.set("status", st);
    else params.delete("status");
    const q = params.toString();
    router.replace(q ? `/projects/${projectId}/issues?${q}` : `/projects/${projectId}/issues`, {
      scroll: false,
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <p className="text-sm text-slate-700" aria-live="polite">
          Total issues (latest scan): <strong>{totalCount}</strong>
          {severity || status ? (
            <span className="text-slate-500">
              {" "}
              · Showing <strong>{visible.length}</strong> with filters
            </span>
          ) : null}
        </p>
        <div className="flex flex-wrap gap-3 text-sm">
          <label className="flex items-center gap-2">
            <span className="text-slate-600">Severity</span>
            <select
              className="rounded-md border border-slate-300 bg-white px-2 py-1"
              value={severity}
              onChange={(e) => setFilter({ severity: e.target.value })}
            >
              <option value="">All</option>
              {SEVERITIES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2">
            <span className="text-slate-600">Status</span>
            <select
              className="rounded-md border border-slate-300 bg-white px-2 py-1"
              value={status}
              onChange={(e) => setFilter({ status: e.target.value })}
            >
              <option value="">All</option>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {error ? (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}

      {loading ? (
        <div className="animate-pulse space-y-2">
          <div className="h-8 rounded bg-slate-200" />
          <div className="h-8 rounded bg-slate-200" />
          <div className="h-8 rounded bg-slate-200" />
        </div>
      ) : visible.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-600">
          No issues for the latest scan.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
            <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-600">
              <tr>
                <th className="px-4 py-3">Title</th>
                <th className="px-4 py-3">Affected area</th>
                <th className="px-4 py-3">Severity</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Detected</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visible.map((row) => (
                <tr
                  key={row.id}
                  tabIndex={0}
                  className="cursor-pointer hover:bg-slate-50 focus:bg-slate-50"
                  onClick={() =>
                    router.push(
                      `/projects/${projectId}/issues/${row.id}?returnSeverity=${encodeURIComponent(
                        severity
                      )}&returnStatus=${encodeURIComponent(status)}`
                    )
                  }
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      router.push(
                        `/projects/${projectId}/issues/${row.id}?returnSeverity=${encodeURIComponent(
                          severity
                        )}&returnStatus=${encodeURIComponent(status)}`
                      );
                    }
                  }}
                >
                  <td className="px-4 py-3 font-medium text-slate-900">{row.title}</td>
                  <td className="px-4 py-3 text-slate-700">{row.affectedArea}</td>
                  <td className="px-4 py-3">
                    <span className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-800">
                      {row.severity}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-700">{row.status}</td>
                  <td className="px-4 py-3 text-xs text-slate-600">
                    {formatLocalDateTime(row.detectedAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
