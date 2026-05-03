/**
 * Supabase public client credentials.
 * Prefer the new publishable key; legacy anon JWT still works during migration.
 * @see https://supabase.com/docs/guides/getting-started/api-keys
 */
export function getSupabaseUrl(): string {
  return process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
}

export function getSupabasePublicKey(): string {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
    ""
  );
}

export function requireSupabasePublicEnv(): { url: string; publicKey: string } {
  const url = getSupabaseUrl();
  const publicKey = getSupabasePublicKey();
  if (!url || !publicKey) {
    throw new Error(
      "Missing Supabase env: set NEXT_PUBLIC_SUPABASE_URL and either NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY"
    );
  }
  return { url, publicKey };
}
