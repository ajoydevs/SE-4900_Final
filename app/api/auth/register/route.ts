import { jsonError } from "@/lib/api/errors";
import { appendSessionCookie } from "@/lib/auth/session-cookie";
import { hashPassword } from "@/lib/auth/password";
import { getSafeRedirectPath } from "@/lib/auth/safe-redirect";
import { createSessionToken } from "@/lib/auth/session";
import { getPool } from "@/lib/db/pool";
import { NextResponse } from "next/server";

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/** Postgres unique_violation */
function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: string }).code === "23505"
  );
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
  const redirectTo = getSafeRedirectPath(
    typeof b.redirectTo === "string" ? b.redirectTo : undefined
  );

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
    if (isUniqueViolation(e)) {
      return jsonError(
        409,
        "USER_EXISTS",
        "An account with this email already exists. Use Sign in instead."
      );
    }
    const msg = e instanceof Error ? e.message : String(e);
    console.error("register insert failed:", e);
    return jsonError(
      500,
      "SIGNUP_FAILED",
      msg || "Database error while creating account."
    );
  }

  let token: string;
  try {
    token = await createSessionToken(userId, email);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Could not create session.";
    console.error("register session token failed:", e);
    return jsonError(500, "SESSION_FAILED", msg);
  }

  const origin = new URL(request.url).origin;
  const dest = new URL(redirectTo, origin);
  const res = NextResponse.redirect(dest, 303);
  appendSessionCookie(res, token);
  return res;
}
