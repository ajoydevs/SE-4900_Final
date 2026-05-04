import { SESSION_COOKIE } from "@/lib/auth/cookie";
import { verifySessionToken } from "@/lib/auth/session";
import { cookies } from "next/headers";

export async function getRouteSession(
  request: Request
): Promise<{ user: { id: string; email: string } | null }> {
  const authHeader = request.headers.get("authorization");
  const bearer = authHeader?.startsWith("Bearer ")
    ? authHeader.slice(7).trim()
    : undefined;

  if (bearer) {
    const user = await verifySessionToken(bearer);
    return { user };
  }

  const cookieStore = await cookies();
  const raw = cookieStore.get(SESSION_COOKIE)?.value;
  const user = await verifySessionToken(raw);
  return { user };
}
