import { jsonError } from "@/lib/api/errors";
import { appendSessionCookie } from "@/lib/auth/session-cookie";
import { hashPassword } from "@/lib/auth/password";
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
  if (password.length > 128) {
    return jsonError(422, "VALIDATION_ERROR", "Password is too long");
  }

  const pool = getPool();
  const passwordHash = await hashPassword(password);

  let userId: string;
  try {
    const { rows } = await pool.query<{ id: string }>(
      `insert into users (email, password_hash) values ($1, $2)
       returning id`,
      [email, passwordHash]
    );
    userId = rows[0]!.id;
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "";
    if (msg.includes("unique") || msg.includes("duplicate")) {
      return jsonError(
        409,
        "USER_EXISTS",
        "An account with this email already exists. Sign in instead."
      );
    }
    return jsonError(500, "SIGNUP_FAILED", msg || "Could not create account");
  }

  const token = await createSessionToken(userId, email);
  const res = NextResponse.json({ ok: true });
  appendSessionCookie(res, token);
  return res;
}
