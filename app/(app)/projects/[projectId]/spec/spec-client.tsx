"use client";

import { ApiClientError, apiJson } from "@/lib/api-client";
import { useToast } from "@/components/Toast";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

type Tab = "upload" | "paste";

type Summary = {
  attached: boolean;
  validationStatus: "valid" | "invalid";
  originalFilename: string | null;
  updatedAt: string;
  validationErrors: { path: string; message: string }[];
};

export function SpecAttachClient({
  projectId,
  initialSummary,
}: {
  projectId: string;
  initialSummary: Summary | null;
}) {
  const router = useRouter();
  const toast = useToast();
  const [tab, setTab] = useState<Tab>("upload");
  const [paste, setPaste] = useState("");
  const [filenameHint, setFilenameHint] = useState("openapi.yaml");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<Summary | null>(initialSummary);

  async function onUpload(file: File | null) {
    if (!file) return;
    setError(null);
    setBusy(true);
    try {
      const fd = new FormData();
      fd.set("mode", "file");
      fd.set("file", file);
      const res = await fetch(`/api/projects/${projectId}/spec`, {
        method: "POST",
        body: fd,
        credentials: "include",
      });
      const text = await res.text();
      const json = text ? JSON.parse(text) : null;
      if (!res.ok) {
        const msg = json?.error?.message || res.statusText;
        throw new Error(msg);
      }
      const o = json.openapi as {
        validationStatus: "valid" | "invalid";
        originalFilename: string | null;
        updatedAt: string;
        validationErrors: { path: string; message: string }[];
      };
      setSummary({
        attached: true,
        validationStatus: o.validationStatus,
        originalFilename: o.originalFilename,
        updatedAt: o.updatedAt,
        validationErrors: o.validationErrors || [],
      });
      toast.show("Specification saved");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  async function onPasteSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const json = await apiJson<{
        openapi: {
          validationStatus: "valid" | "invalid";
          originalFilename: string | null;
          updatedAt: string;
          validationErrors: { path: string; message: string }[];
        };
      }>(`/api/projects/${projectId}/spec`, {
        method: "POST",
        body: JSON.stringify({
          mode: "paste",
          text: paste,
          filenameHint,
        }),
      });
      const o = json.openapi;
      setSummary({
        attached: true,
        validationStatus: o.validationStatus,
        originalFilename: o.originalFilename,
        updatedAt: o.updatedAt,
        validationErrors: o.validationErrors || [],
      });
      toast.show("Specification saved");
      router.refresh();
    } catch (err) {
      if (err instanceof ApiClientError) {
        setError(err.message);
      } else {
        setError("Save failed");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex gap-2 border-b border-slate-200">
        <button
          type="button"
          className={`border-b-2 px-3 py-2 text-sm font-medium ${
            tab === "upload"
              ? "border-slate-900 text-slate-900"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
          onClick={() => setTab("upload")}
        >
          Upload file
        </button>
        <button
          type="button"
          className={`border-b-2 px-3 py-2 text-sm font-medium ${
            tab === "paste"
              ? "border-slate-900 text-slate-900"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
          onClick={() => setTab("paste")}
        >
          Paste text
        </button>
      </div>

      {tab === "upload" ? (
        <div className="rounded-lg border border-dashed border-slate-300 bg-white p-6">
          <label className="block text-sm font-medium text-slate-700" htmlFor="file">
            Choose .yaml, .yml, or .json (max 2 MB)
          </label>
          <input
            id="file"
            type="file"
            accept=".yaml,.yml,.json,application/json,text/yaml,text/x-yaml"
            disabled={busy}
            onChange={(e) => void onUpload(e.target.files?.[0] || null)}
            className="mt-2 block w-full text-sm"
          />
        </div>
      ) : (
        <form onSubmit={(e) => void onPasteSubmit(e)} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700" htmlFor="hint">
              Filename hint (optional)
            </label>
            <input
              id="hint"
              value={filenameHint}
              onChange={(e) => setFilenameHint(e.target.value)}
              className="mt-1 w-full max-w-md rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700" htmlFor="paste">
              OpenAPI YAML or JSON
            </label>
            <textarea
              id="paste"
              value={paste}
              onChange={(e) => setPaste(e.target.value)}
              rows={14}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-xs"
            />
          </div>
          <button
            type="submit"
            disabled={busy || paste.trim().length === 0}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {busy ? "Saving…" : "Save pasted spec"}
          </button>
        </form>
      )}

      {error ? (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}

      {summary?.attached ? (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-800">
          <p className="font-medium">Current specification</p>
          <p className="mt-1 text-xs text-slate-600">
            {summary.originalFilename || "Pasted spec"} ·{" "}
            <span
              className={
                summary.validationStatus === "valid"
                  ? "text-emerald-800"
                  : "text-amber-800"
              }
            >
              {summary.validationStatus === "valid" ? "Valid OpenAPI" : "Invalid OpenAPI"}
            </span>
          </p>
          {summary.validationErrors?.length ? (
            <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-red-800">
              {summary.validationErrors.slice(0, 8).map((er, i) => (
                <li key={i}>
                  {er.path ? `${er.path}: ` : ""}
                  {er.message}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      <p className="text-sm">
        <Link href={`/projects/${projectId}`} className="underline">
          Return to project
        </Link>
      </p>
    </div>
  );
}
