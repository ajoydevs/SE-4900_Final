import { jsonError } from "@/lib/api/errors";
import { getSupabasePublicKey, getSupabaseUrl } from "@/lib/supabase/env";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

function getServiceRoleKey(): string | undefined {
  return process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || undefined;
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * Creates a confirmed user via Admin API (no signup email), then opens a session using the
 * publishable/anon client and attaches Set-Cookie on this response so the browser does not rely
 * on a second client signIn call (which often misses cookie persistence after fetch).
 */
export async function POST(request: Request) {
  const url = getSupabaseUrl();
  const publicKey = getSupabasePublicKey();
  const serviceKey = getServiceRoleKey();
  if (!url || !publicKey) {
    return jsonError(
      503,
      "AUTH_SIGNUP_UNAVAILABLE",
      "Missing NEXT_PUBLIC_SUPABASE_URL or publishable/anon key."
    );
  }
  if (!serviceKey) {
    return jsonError(
      503,
      "AUTH_SIGNUP_UNAVAILABLE",
      "Add SUPABASE_SERVICE_ROLE_KEY to .env.local (server only, never commit). It is required for Create account without sending Supabase auth emails."
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(422, "VALIDATION_ERROR", "Invalid JSON body");
  }

  const b = body as Record<string, unknown>;
  const email = typeof b.email === "string" ? b.email.trim() : "";
  const password = typeof b.password === "string" ? b.password : "";

  if (!isValidEmail(email)) {
    return jsonError(422, "VALIDATION_ERROR", "Invalid email");
  }
  if (password.length < 6) {
    return jsonError(422, "VALIDATION_ERROR", "Password must be at least 6 characters");
  }
  if (password.length > 128) {
    return jsonError(422, "VALIDATION_ERROR", "Password is too long");
  }

  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (createErr) {
    const msg = createErr.message.toLowerCase();
    if (
      msg.includes("already registered") ||
      msg.includes("already exists") ||
      msg.includes("duplicate") ||
      createErr.code === "email_exists"
    ) {
      return jsonError(
        409,
        "USER_EXISTS",
        "An account with this email already exists. Sign in instead."
      );
    }
    return jsonError(400, "SIGNUP_FAILED", createErr.message);
  }

  const cookieStore = await cookies();
  const response = NextResponse.json({ ok: true });

  const supabase = createServerClient(url, publicKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  const { error: signErr } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (signErr) {
    return jsonError(
      502,
      "SIGNIN_AFTER_SIGNUP_FAILED",
      `Account was created but session could not be started: ${signErr.message}`
    );
  }

  return response;
}
