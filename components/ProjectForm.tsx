"use client";

import { ApiClientError, apiJson } from "@/lib/api-client";
import type { ProjectListItem } from "@/lib/types";
import { useRouter } from "next/navigation";
import { useState } from "react";

type Mode = "create" | "edit";

export function ProjectForm({
  mode,
  projectId,
  initial,
}: {
  mode: Mode;
  projectId?: string;
  initial?: Partial<Pick<ProjectListItem, "name" | "repositoryUrl" | "documentationSourceUrl">>;
}) {
  const router = useRouter();
  const [name, setName] = useState(initial?.name ?? "");
  const [repositoryUrl, setRepositoryUrl] = useState(initial?.repositoryUrl ?? "");
  const [documentationSourceUrl, setDocumentationSourceUrl] = useState(
    initial?.documentationSourceUrl ?? ""
  );
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [apiError, setApiError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFieldErrors({});
    setApiError(null);
    setSubmitting(true);
    try {
      if (mode === "create") {
        await apiJson<{ project: ProjectListItem }>("/api/projects", {
          method: "POST",
          body: JSON.stringify({
            name,
            repositoryUrl,
            documentationSourceUrl,
          }),
        });
        router.push("/");
        router.refresh();
      } else if (projectId) {
        await apiJson<{ project: ProjectListItem }>(`/api/projects/${projectId}`, {
          method: "PATCH",
          body: JSON.stringify({
            name,
            repositoryUrl,
            documentationSourceUrl,
          }),
        });
        router.push(`/projects/${projectId}`);
        router.refresh();
      }
    } catch (err) {
      if (err instanceof ApiClientError && err.body?.error?.details) {
        const fields = err.body.error.details.fields as Record<string, string> | undefined;
        if (fields) {
          setFieldErrors({
            name: fields.name || "",
            repositoryUrl: fields.repositoryUrl || "",
            documentationSourceUrl: fields.documentationSourceUrl || "",
          });
        }
      }
      setApiError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={(e) => void onSubmit(e)} className="mx-auto max-w-xl space-y-6">
      <div>
        <label className="block text-sm font-medium text-slate-700" htmlFor="name">
          Project name
        </label>
        <input
          id="name"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm outline-none focus:ring-2 focus:ring-slate-400"
        />
        {fieldErrors.name ? (
          <p className="mt-1 text-sm text-red-600">{fieldErrors.name}</p>
        ) : null}
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700" htmlFor="repo">
          GitHub repository URL
        </label>
        <input
          id="repo"
          type="url"
          required
          value={repositoryUrl}
          onChange={(e) => setRepositoryUrl(e.target.value)}
          className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm outline-none focus:ring-2 focus:ring-slate-400"
          placeholder="https://github.com/org/repo"
        />
        {fieldErrors.repositoryUrl ? (
          <p className="mt-1 text-sm text-red-600">{fieldErrors.repositoryUrl}</p>
        ) : null}
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700" htmlFor="doc">
          Documentation source URL
        </label>
        <input
          id="doc"
          type="url"
          required
          value={documentationSourceUrl}
          onChange={(e) => setDocumentationSourceUrl(e.target.value)}
          className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm outline-none focus:ring-2 focus:ring-slate-400"
          placeholder="https://docs.example.com"
        />
        {fieldErrors.documentationSourceUrl ? (
          <p className="mt-1 text-sm text-red-600">{fieldErrors.documentationSourceUrl}</p>
        ) : null}
      </div>
      {apiError ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {apiError}
        </div>
      ) : null}
      <button
        type="submit"
        disabled={submitting}
        className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow hover:bg-slate-800 disabled:opacity-60"
      >
        {submitting ? "Saving…" : "Save Project"}
      </button>
    </form>
  );
}
