import { createServerClient } from "@supabase/ssr";
import { requireSupabasePublicEnv } from "@/lib/supabase/env";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=missing_code`);
  }

  let url: string;
  let publicKey: string;
  try {
    ({ url, publicKey } = requireSupabasePublicEnv());
  } catch {
    return NextResponse.redirect(`${origin}/login?error=missing_env`);
  }

  const cookieStore = await cookies();
  // #region agent log
  {
    const names = cookieStore.getAll().map((c) => c.name);
    const hasPkceVerifier = names.some((n) => n.endsWith("-code-verifier"));
    fetch("http://127.0.0.1:7792/ingest/18dde792-c522-4d1c-b861-703aa48af361", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Debug-Session-Id": "2b5a29",
      },
      body: JSON.stringify({
        sessionId: "2b5a29",
        runId: "pre-fix",
        hypothesisId: "H1_H5",
        location: "app/auth/callback/route.ts:pre-exchange",
        message: "callback before exchangeCodeForSession",
        data: {
          codeLen: code.length,
          hasPkceVerifier,
          sbCookieNames: names.filter((n) => n.startsWith("sb-")),
          origin,
          next,
        },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
  }
  // #endregion
  const supabase = createServerClient(
    url,
    publicKey,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            /* ignore */
          }
        },
      },
    }
  );

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  // #region agent log
  {
    fetch("http://127.0.0.1:7792/ingest/18dde792-c522-4d1c-b861-703aa48af361", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Debug-Session-Id": "2b5a29",
      },
      body: JSON.stringify({
        sessionId: "2b5a29",
        runId: "pre-fix",
        hypothesisId: "H2_H3_H4",
        location: "app/auth/callback/route.ts:post-exchange",
        message: "callback after exchangeCodeForSession",
        data: {
          exchangeOk: !error,
          errName: error?.name ?? null,
          errMessage: error?.message ?? null,
        },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
  }
  // #endregion
  if (error) {
    return NextResponse.redirect(`${origin}/login?error=auth`);
  }

  return NextResponse.redirect(`${origin}${next}`);
}
