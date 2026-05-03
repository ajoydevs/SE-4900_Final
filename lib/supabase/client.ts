import { createBrowserClient } from "@supabase/ssr";
import { requireSupabasePublicEnv } from "@/lib/supabase/env";

export function createBrowserSupabase() {
  const { url, publicKey } = requireSupabasePublicEnv();
  return createBrowserClient(url, publicKey);
}
