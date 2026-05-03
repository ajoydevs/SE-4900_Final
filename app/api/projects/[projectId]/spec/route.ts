import { jsonError } from "@/lib/api/errors";
import { getRouteSupabase } from "@/lib/api/supabase-route";
import { validateOpenApiText } from "@/lib/openapi/validate";
import { sha256HexUtf8, stripBom } from "@/lib/util/hash";
import { isUuid } from "@/lib/validation/project";
import { NextResponse } from "next/server";

const MAX_BYTES = 2 * 1024 * 1024;

function allowedExtension(name: string): boolean {
  const lower = name.toLowerCase();
  return (
    lower.endsWith(".yaml") || lower.endsWith(".yml") || lower.endsWith(".json")
  );
}

type Ctx = { params: Promise<{ projectId: string }> };

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
    .select("id")
    .eq("id", projectId)
    .maybeSingle();
  if (pErr || !project) {
    return jsonError(404, "NOT_FOUND", "Project not found");
  }

  const contentType = request.headers.get("content-type") || "";

  let rawText: string;
  let originalFilename: string | null = null;
  let format: "yaml" | "json";

  if (contentType.includes("multipart/form-data")) {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return jsonError(422, "VALIDATION_ERROR", "Missing file field");
    }
    const name = file.name || "spec.yaml";
    if (!allowedExtension(name)) {
      return jsonError(
        415,
        "UNSUPPORTED_MEDIA_TYPE",
        "Only .yaml, .yml, and .json uploads are supported."
      );
    }
    const buf = Buffer.from(await file.arrayBuffer());
    if (buf.length > MAX_BYTES) {
      return jsonError(
        413,
        "VALIDATION_ERROR",
        "File exceeds 2 MB limit."
      );
    }
    rawText = buf.toString("utf8");
    originalFilename = name;
    format = name.toLowerCase().endsWith(".json") ? "json" : "yaml";
  } else if (contentType.includes("application/json")) {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return jsonError(422, "VALIDATION_ERROR", "Invalid JSON body");
    }
    const b = body as Record<string, unknown>;
    if (b.mode !== "paste" || typeof b.text !== "string") {
      return jsonError(
        422,
        "VALIDATION_ERROR",
        'JSON mode must be { "mode": "paste", "text": "..." }'
      );
    }
    const text = b.text;
    if (Buffer.byteLength(text, "utf8") > MAX_BYTES) {
      return jsonError(413, "VALIDATION_ERROR", "Pasted spec exceeds 2 MB.");
    }
    rawText = text;
    const hint =
      typeof b.filenameHint === "string" ? b.filenameHint : "pasted.yaml";
    originalFilename = hint.includes(".") ? hint : `${hint}.yaml`;
    format = hint.toLowerCase().endsWith(".json") ? "json" : "yaml";
  } else {
    return jsonError(
      415,
      "UNSUPPORTED_MEDIA_TYPE",
      "Use application/json or multipart/form-data"
    );
  }

  const canonical = stripBom(rawText);
  const validated = await validateOpenApiText(canonical);
  const validationStatus = validated.ok ? "valid" : "invalid";
  const validationErrors = validated.ok
    ? []
    : validated.errors.map((e) => ({
        path: e.path,
        message: e.message,
      }));

  const contentSha = sha256HexUtf8(canonical);

  const { data: upserted, error: uErr } = await supabase
    .from("openapi_specs")
    .upsert(
      {
        project_id: projectId,
        user_id: user.id,
        raw_spec_text: validated.ok ? validated.canonicalText : canonical,
        original_filename: originalFilename,
        format: validated.ok ? validated.format : format,
        validation_status: validationStatus,
        validation_errors: validationErrors.length ? validationErrors : null,
        content_sha256: validated.ok
          ? sha256HexUtf8(validated.canonicalText)
          : contentSha,
      },
      { onConflict: "project_id" }
    )
    .select("validation_status, validation_errors, original_filename, updated_at")
    .single();

  if (uErr || !upserted) {
    return jsonError(500, "INTERNAL_ERROR", uErr?.message || "Save failed");
  }

  return NextResponse.json({
    openapi: {
      attached: true,
      validationStatus: upserted.validation_status,
      validationErrors: upserted.validation_errors ?? [],
      originalFilename: upserted.original_filename,
      updatedAt: upserted.updated_at,
    },
  });
}
