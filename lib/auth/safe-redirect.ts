/**
 * After login we only allow in-app paths. Blocks external/open redirects and
 * `/api/*` URLs (those are never valid browser navigation targets).
 */
export function getSafeRedirectPath(raw: string | null | undefined): string {
  const fallback = "/";
  if (raw == null || raw === "") return fallback;
  const trimmed = raw.trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) return fallback;
  if (trimmed.startsWith("/api/")) return fallback;
  return trimmed;
}
