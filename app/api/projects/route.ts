import { jsonError } from "@/lib/api/errors";
import { mapProject } from "@/lib/api/mappers";
import { getAppUserId } from "@/lib/auth/app-user";
import { validateProjectInput } from "@/lib/validation/project";
import { getPool } from "@/lib/db/pool";
import { NextResponse } from "next/server";

export async function GET() {
  const userId = await getAppUserId();

  const pool = getPool();
  const { rows } = await pool.query(
    `select * from projects where user_id = $1 order by created_at desc`,
    [userId]
  );

  return NextResponse.json({
    projects: rows.map((row) => mapProject(row as never)),
  });
}

export async function POST(request: Request) {
  const userId = await getAppUserId();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(422, "VALIDATION_ERROR", "Invalid JSON body");
  }

  const b = body as Record<string, unknown>;
  const v = validateProjectInput({
    name: b.name,
    repositoryUrl: b.repositoryUrl,
    documentationSourceUrl: b.documentationSourceUrl,
  });
  if (!v.ok) {
    return jsonError(422, "VALIDATION_ERROR", "Validation failed", {
      fields: v.errors,
    });
  }

  const pool = getPool();
  const { rows } = await pool.query(
    `insert into projects (user_id, name, repository_url, documentation_source_url)
     values ($1, $2, $3, $4)
     returning *`,
    [userId, v.name, v.repositoryUrl, v.documentationSourceUrl]
  );

  const row = rows[0];
  if (!row) {
    return jsonError(500, "INTERNAL_ERROR", "Insert failed");
  }

  return NextResponse.json({ project: mapProject(row as never) }, { status: 201 });
}
