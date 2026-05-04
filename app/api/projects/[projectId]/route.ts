import { jsonError } from "@/lib/api/errors";
import { mapProject } from "@/lib/api/mappers";
import { getRouteSession } from "@/lib/api/route-auth";
import { isUuid, validateProjectInput } from "@/lib/validation/project";
import { getPool } from "@/lib/db/pool";
import { NextResponse } from "next/server";

type Ctx = { params: Promise<{ projectId: string }> };

export async function GET(request: Request, ctx: Ctx) {
  const { projectId } = await ctx.params;
  if (!isUuid(projectId)) {
    return jsonError(404, "NOT_FOUND", "Project not found");
  }

  const { user } = await getRouteSession(request);
  if (!user) {
    return jsonError(401, "UNAUTHORIZED", "Authentication required");
  }

  const pool = getPool();
  const { rows } = await pool.query(
    `select * from projects where id = $1 and user_id = $2`,
    [projectId, user.id]
  );
  const project = rows[0];
  if (!project) {
    return jsonError(404, "NOT_FOUND", "Project not found");
  }

  const specRes = await pool.query(
    `select validation_status, original_filename, updated_at from openapi_specs
     where project_id = $1`,
    [projectId]
  );
  const spec = specRes.rows[0];

  const openapi = spec
    ? {
        attached: true,
        originalFilename: spec.original_filename as string | null,
        validationStatus: spec.validation_status as "valid" | "invalid",
        updatedAt: spec.updated_at as string,
      }
    : {
        attached: false,
        originalFilename: null,
        validationStatus: "invalid" as const,
        updatedAt: null as string | null,
      };

  return NextResponse.json({
    project: {
      ...mapProject(project as never),
      openapi,
    },
  });
}

export async function PATCH(request: Request, ctx: Ctx) {
  const { projectId } = await ctx.params;
  if (!isUuid(projectId)) {
    return jsonError(404, "NOT_FOUND", "Project not found");
  }

  const { user } = await getRouteSession(request);
  if (!user) {
    return jsonError(401, "UNAUTHORIZED", "Authentication required");
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(422, "VALIDATION_ERROR", "Invalid JSON body");
  }

  const b = body as Record<string, unknown>;
  const patch: Record<string, string> = {};
  if ("name" in b) patch.name = String(b.name ?? "");
  if ("repositoryUrl" in b) patch.repositoryUrl = String(b.repositoryUrl ?? "");
  if ("documentationSourceUrl" in b)
    patch.documentationSourceUrl = String(b.documentationSourceUrl ?? "");

  const pool = getPool();
  const existingRes = await pool.query(
    `select * from projects where id = $1 and user_id = $2`,
    [projectId, user.id]
  );
  const existing = existingRes.rows[0];
  if (!existing) {
    return jsonError(404, "NOT_FOUND", "Project not found");
  }

  const merged = {
    name: "name" in patch ? patch.name : (existing as { name: string }).name,
    repositoryUrl:
      "repositoryUrl" in patch
        ? patch.repositoryUrl
        : (existing as { repository_url: string }).repository_url,
    documentationSourceUrl:
      "documentationSourceUrl" in patch
        ? patch.documentationSourceUrl
        : (existing as { documentation_source_url: string })
            .documentation_source_url,
  };

  const v = validateProjectInput({
    name: merged.name,
    repositoryUrl: merged.repositoryUrl,
    documentationSourceUrl: merged.documentationSourceUrl,
  });
  if (!v.ok) {
    return jsonError(422, "VALIDATION_ERROR", "Validation failed", {
      fields: v.errors,
    });
  }

  const upd = await pool.query(
    `update projects set
       name = $2,
       repository_url = $3,
       documentation_source_url = $4
     where id = $1 and user_id = $5
     returning *`,
    [projectId, v.name, v.repositoryUrl, v.documentationSourceUrl, user.id]
  );

  const data = upd.rows[0];
  if (!data) {
    return jsonError(500, "INTERNAL_ERROR", "Update failed");
  }

  const specRes = await pool.query(
    `select validation_status, original_filename, updated_at from openapi_specs
     where project_id = $1`,
    [projectId]
  );
  const spec = specRes.rows[0];

  const openapi = spec
    ? {
        attached: true,
        originalFilename: spec.original_filename as string | null,
        validationStatus: spec.validation_status as "valid" | "invalid",
        updatedAt: spec.updated_at as string,
      }
    : {
        attached: false,
        originalFilename: null,
        validationStatus: "invalid" as const,
        updatedAt: null as string | null,
      };

  return NextResponse.json({
    project: {
      ...mapProject(data as never),
      openapi,
    },
  });
}
