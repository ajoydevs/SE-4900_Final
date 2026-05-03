import { createServerClient } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import type { User } from "@supabase/supabase-js";
import { requireSupabasePublicEnv } from "@/lib/supabase/env";

function getEnv() {
  return requireSupabasePublicEnv();
}

/**
 * Supabase client for Route Handlers: session from cookies or Authorization: Bearer.
 */
export async function getRouteSupabase(
  request: Request
): Promise<{ supabase: SupabaseClient; user: User | null }> {
  const { url, publicKey } = getEnv();
  const authHeader = request.headers.get("authorization");
  const bearer =
    authHeader?.startsWith("Bearer ") ? authHeader.slice(7).trim() : undefined;

  if (bearer) {
    const supabase = createClient(url, publicKey, {
      global: { headers: { Authorization: `Bearer ${bearer}` } },
    });
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();
    if (error || !user) {
      return { supabase, user: null };
    }
    return { supabase, user };
  }

  const cookieStore = await cookies();
  const supabase = createServerClient(url, publicKey, {
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
          /* ignore when not mutable */
        }
      },
    },
  });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}
