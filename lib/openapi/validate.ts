import SwaggerParser from "@apidevtools/swagger-parser";
import { parse as parseYaml } from "yaml";
import { stripBom } from "@/lib/util/hash";

const MAX_BYTES = 2 * 1024 * 1024;
const PARSE_TIMEOUT_MS = 3000;

export type ValidationErrorItem = { path: string; message: string };

function byteLengthUtf8(s: string): number {
  return Buffer.byteLength(s, "utf8");
}

function parseDocument(raw: string): unknown {
  const t = raw.trim();
  if (t.startsWith("{") || t.startsWith("[")) {
    return JSON.parse(t) as unknown;
  }
  return parseYaml(t) as unknown;
}

async function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  let to: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      p,
      new Promise<T>((_, rej) => {
        to = setTimeout(() => rej(new Error(label)), ms);
      }),
    ]);
  } finally {
    if (to) clearTimeout(to);
  }
}

export type OpenApiValidateResult =
  | {
      ok: true;
      canonicalText: string;
      format: "yaml" | "json";
      parsed: Record<string, unknown>;
    }
  | { ok: false; errors: ValidationErrorItem[] };

export async function validateOpenApiText(rawInput: string): Promise<OpenApiValidateResult> {
  const canonicalText = stripBom(rawInput);
  if (byteLengthUtf8(canonicalText) > MAX_BYTES) {
    return {
      ok: false,
      errors: [{ path: "", message: "OpenAPI document exceeds 2 MB limit." }],
    };
  }

  let parsed: unknown;
  try {
    parsed = parseDocument(canonicalText);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Invalid YAML/JSON";
    return { ok: false, errors: [{ path: "", message: msg }] };
  }

  if (!parsed || typeof parsed !== "object") {
    return { ok: false, errors: [{ path: "", message: "Document must be an object." }] };
  }

  const format: "yaml" | "json" = rawInput.trim().startsWith("{") ? "json" : "yaml";

  try {
    await withTimeout(
      // swagger-parser typings expect Document; runtime accepts parsed JSON/YAML objects.
      SwaggerParser.validate(parsed as never),
      PARSE_TIMEOUT_MS,
      "OPENAPI_PARSE_TIMEOUT"
    );
  } catch (e) {
    const msg =
      e instanceof Error
        ? e.message === "OPENAPI_PARSE_TIMEOUT"
          ? "OpenAPI validation timed out; try simplifying the specification."
          : e.message
        : "OpenAPI validation failed";
    return {
      ok: false,
      errors: [{ path: "", message: msg }],
    };
  }

  return { ok: true, canonicalText, format, parsed: parsed as Record<string, unknown> };
}
