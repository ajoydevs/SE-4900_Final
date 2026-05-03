import type { OpenApiValidateResult } from "@/lib/openapi/validate";

export const ENGINE_VERSION = "drift-engine@1.0.0";

export type DocFetchResult = {
  status: "skipped" | "ok" | "failed";
  httpStatus: number | null;
  error: string | null;
  plaintext: string | null;
};

export type DriftIssuePayload = {
  title: string;
  affected_area: string;
  severity: "High" | "Medium" | "Low";
  status: "Open";
  reason: string;
  documentation_reference: string;
  rule_id: string;
};

const HTTP_METHODS = new Set([
  "get",
  "post",
  "put",
  "patch",
  "delete",
  "options",
  "head",
  "trace",
]);

export type NormalizedOperation = {
  method: string;
  path: string;
  operationId?: string;
  summary?: string;
  description?: string;
  tags?: string[];
  responses?: Record<string, unknown>;
};

function isNonEmpty(s: string | undefined): boolean {
  return typeof s === "string" && s.trim().length > 0;
}

function htmlToPlainText(html: string): string {
  const noScript = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ");
  const stripped = noScript.replace(/<[^>]+>/g, " ");
  return stripped.replace(/\s+/g, " ").trim();
}

export async function fetchDocumentationPage(
  url: string,
  signal: AbortSignal
): Promise<DocFetchResult> {
  try {
    const res = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal,
      headers: {
        "User-Agent": "DocSyncMVP/1.0 (+https://example.invalid)",
        Accept: "text/html, text/plain, application/json;q=0.9,*/*;q=0.1",
      },
    });
    const httpStatus = res.status;
    if (!res.ok) {
      return {
        status: "failed",
        httpStatus,
        error: `HTTP ${httpStatus}`,
        plaintext: null,
      };
    }
    const text = await res.text();
    const ct = res.headers.get("content-type") || "";
    const plain =
      ct.includes("html") || text.trim().startsWith("<")
        ? htmlToPlainText(text)
        : text;
    return { status: "ok", httpStatus, error: null, plaintext: plain };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Network error";
    return { status: "failed", httpStatus: null, error: msg, plaintext: null };
  }
}

function extractOperationsFromOpenApi3(
  spec: Record<string, unknown>
): NormalizedOperation[] {
  const paths = (spec.paths || {}) as Record<string, Record<string, unknown>>;
  const ops: NormalizedOperation[] = [];
  for (const [path, pathItem] of Object.entries(paths)) {
    if (!pathItem || typeof pathItem !== "object") continue;
    for (const [key, op] of Object.entries(pathItem)) {
      if (!HTTP_METHODS.has(key.toLowerCase())) continue;
      if (!op || typeof op !== "object") continue;
      const o = op as Record<string, unknown>;
      const method = key.toUpperCase();
      const tags = Array.isArray(o.tags)
        ? (o.tags as unknown[]).filter((t): t is string => typeof t === "string")
        : undefined;
      ops.push({
        method,
        path,
        operationId:
          typeof o.operationId === "string" ? o.operationId : undefined,
        summary: typeof o.summary === "string" ? o.summary : undefined,
        description: typeof o.description === "string" ? o.description : undefined,
        tags,
        responses: (o.responses || {}) as Record<string, unknown>,
      });
    }
  }
  return ops;
}

function extractOperationsFromSwagger2(
  spec: Record<string, unknown>
): NormalizedOperation[] {
  const paths = (spec.paths || {}) as Record<string, Record<string, unknown>>;
  const ops: NormalizedOperation[] = [];
  for (const [path, pathItem] of Object.entries(paths)) {
    if (!pathItem || typeof pathItem !== "object") continue;
    for (const [key, op] of Object.entries(pathItem)) {
      if (!HTTP_METHODS.has(key.toLowerCase())) continue;
      if (!op || typeof op !== "object") continue;
      const o = op as Record<string, unknown>;
      const method = key.toUpperCase();
      const tags = Array.isArray(o.tags)
        ? (o.tags as unknown[]).filter((t): t is string => typeof t === "string")
        : undefined;
      ops.push({
        method,
        path,
        operationId:
          typeof o.operationId === "string" ? o.operationId : undefined,
        summary: typeof o.summary === "string" ? o.summary : undefined,
        description: typeof o.description === "string" ? o.description : undefined,
        tags,
      });
    }
  }
  return ops;
}

function extractOperations(parsed: Record<string, unknown>): NormalizedOperation[] {
  if (typeof parsed.openapi === "string" && parsed.openapi.startsWith("3")) {
    return extractOperationsFromOpenApi3(parsed);
  }
  if ((parsed as { swagger?: string }).swagger === "2.0") {
    return extractOperationsFromSwagger2(parsed);
  }
  if (parsed.openapi) {
    return extractOperationsFromOpenApi3(parsed);
  }
  return [];
}

function docRefForOp(
  documentationSourceUrl: string,
  operationId?: string
): string {
  if (operationId && operationId.trim()) {
    const base = documentationSourceUrl.replace(/#.*$/, "");
    return `${base}#operation-${encodeURIComponent(operationId)}`;
  }
  return documentationSourceUrl;
}

function pathWithoutBraceSegments(path: string): string {
  return path
    .replace(/\{[^}]+\}/g, "")
    .replace(/\/+/g, "/")
    .toLowerCase();
}

function lastSignificantSegment(path: string): string | null {
  const parts = path.split("/").filter(Boolean);
  if (parts.length === 0) return null;
  const last = parts[parts.length - 1];
  const cleaned = last.replace(/\{|\}/g, "").toLowerCase();
  return cleaned.length > 0 ? cleaned : null;
}

function docMentionsPath(docLower: string, path: string): boolean {
  const lowerPath = path.toLowerCase();
  const stripped = pathWithoutBraceSegments(path);
  if (stripped.length > 1 && docLower.includes(stripped)) return true;
  if (docLower.includes(lowerPath)) return true;
  const seg = lastSignificantSegment(path);
  if (seg && seg.length > 1 && docLower.includes(seg)) return true;
  return false;
}

function has4xxOr5xxResponses(responses: Record<string, unknown> | undefined): boolean {
  if (!responses) return false;
  const keys = Object.keys(responses);
  if (keys.some((k) => /^[45]\d{2}$/.test(k))) return true;
  if ("default" in responses) return true;
  return false;
}

export type RunDriftScanInput = {
  repositoryUrl: string;
  documentationSourceUrl: string;
  openapi: Extract<OpenApiValidateResult, { ok: true }>;
};

export type RunDriftScanOutput = {
  docFetch: DocFetchResult;
  operationsCount: number;
  issues: DriftIssuePayload[];
  result: "no_drift" | "drift" | "error";
  errorMessage?: string;
};

export async function runDriftScan(
  input: RunDriftScanInput,
  options?: { overallDeadlineMs?: number }
): Promise<RunDriftScanOutput> {
  const deadlineMs = options?.overallDeadlineMs ?? 30_000;
  const deadline = Date.now() + deadlineMs;

  const parsed = input.openapi.parsed;
  const isOas3 =
    typeof parsed.openapi === "string" && parsed.openapi.startsWith("3");

  const operations = extractOperations(parsed);
  if (Date.now() > deadline) {
    return {
      docFetch: {
        status: "skipped",
        httpStatus: null,
        error: null,
        plaintext: null,
      },
      operationsCount: operations.length,
      issues: [],
      result: "error",
      errorMessage: "Scan processing budget exceeded.",
    };
  }

  const docController = new AbortController();
  const docTimeout = setTimeout(() => docController.abort(), 10_000);
  let docFetch: DocFetchResult;
  try {
    docFetch = await fetchDocumentationPage(
      input.documentationSourceUrl,
      docController.signal
    );
  } finally {
    clearTimeout(docTimeout);
  }

  if (Date.now() > deadline) {
    return {
      docFetch,
      operationsCount: operations.length,
      issues: [],
      result: "error",
      errorMessage: "Scan processing budget exceeded.",
    };
  }

  if (operations.length === 0) {
    return {
      docFetch,
      operationsCount: 0,
      issues: [],
      result: "no_drift",
    };
  }

  const docPlain = docFetch.plaintext
    ? docFetch.plaintext.toLowerCase()
    : "";
  const dedupe = new Set<string>();
  const issues: DriftIssuePayload[] = [];

  const pushIssue = (issue: DriftIssuePayload) => {
    const key = `${issue.rule_id}|${issue.affected_area}`;
    if (dedupe.has(key)) return;
    dedupe.add(key);
    issues.push(issue);
  };

  for (const op of operations) {
    const area = `${op.method} ${op.path}`;
    const docRef = docRefForOp(
      input.documentationSourceUrl,
      op.operationId
    );

    if (!isNonEmpty(op.description) && !isNonEmpty(op.summary)) {
      pushIssue({
        title: "Missing description for operation",
        affected_area: area,
        severity: "Medium",
        status: "Open",
        reason:
          "Neither summary nor description is provided for this operation, which makes documentation alignment difficult.",
        documentation_reference: docRef,
        rule_id: "OAS_MISSING_DESCRIPTION",
      });
    }

    if (!op.tags || op.tags.length === 0) {
      pushIssue({
        title: "Operation not grouped by tags",
        affected_area: area,
        severity: "Low",
        status: "Open",
        reason:
          "Operations without tags are harder to navigate in documentation portals and review dashboards.",
        documentation_reference: input.documentationSourceUrl,
        rule_id: "OAS_MISSING_TAGS",
      });
    }

    if (isOas3 && !has4xxOr5xxResponses(op.responses)) {
      pushIssue({
        title: "Undocumented error responses",
        affected_area: area,
        severity: "Low",
        status: "Open",
        reason:
          "No 4xx/5xx responses (or default) are declared; consumers may misunderstand failure modes relative to published documentation.",
        documentation_reference: docRef,
        rule_id: "OAS_MISSING_ERROR_RESPONSES",
      });
    }

    if (docFetch.status === "ok" && docPlain.length > 0) {
      if (!docMentionsPath(docPlain, op.path)) {
        const sev: "High" | "Medium" =
          op.method === "GET" ? "High" : "Medium";
        pushIssue({
          title: "Documentation may be missing endpoint",
          affected_area: area,
          severity: sev,
          status: "Open",
          reason: `Fetched documentation page text did not clearly include a recognizable pattern for ${op.path}. Repository metadata for context: ${input.repositoryUrl}`,
          documentation_reference: input.documentationSourceUrl,
          rule_id: "DOC_PATH_NOT_FOUND",
        });
      }
    }
  }

  return {
    docFetch,
    operationsCount: operations.length,
    issues,
    result: issues.length > 0 ? "drift" : "no_drift",
  };
}
