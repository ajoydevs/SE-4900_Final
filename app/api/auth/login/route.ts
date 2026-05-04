import { jsonError } from "@/lib/api/errors";
import { appendSessionCookie } from "@/lib/auth/session-cookie";
import { verifyPassword } from "@/lib/auth/password";
import { createSessionToken } from "@/lib/auth/session";
import { getPool } from "@/lib/db/pool";
import { NextResponse } from "next/server";

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(422, "VALIDATION_ERROR", "Invalid JSON body");
  }

  const b = body as Record<string, unknown>;
  const emailRaw = typeof b.email === "string" ? b.email.trim() : "";
  const email = emailRaw.toLowerCase();
  const password = typeof b.password === "string" ? b.password : "";

  if (!isValidEmail(email)) {
    return jsonError(422, "VALIDATION_ERROR", "Invalid email");
  }
  if (password.length < 6) {
    return jsonError(
      422,
      "VALIDATION_ERROR",
      "Password must be at least 6 characters"
    );
  }

  const pool = getPool();
  const { rows } = await pool.query<{ id: string; password_hash: string }>(
    `select id, password_hash from users where lower(email) = lower($1)`,
    [email]
  );
  const row = rows[0];
  if (!row) {
    return jsonError(401, "INVALID_CREDENTIALS", "Invalid email or password");
  }

  const ok = await verifyPassword(password, row.password_hash);
  if (!ok) {
    return jsonError(401, "INVALID_CREDENTIALS", "Invalid email or password");
  }

  const token = await createSessionToken(row.id, email);
  const res = NextResponse.json({ ok: true });
  appendSessionCookie(res, token);
  return res;
}
