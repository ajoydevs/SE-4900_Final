import { jsonError } from "@/lib/api/errors";
import { SESSION_COOKIE } from "@/lib/auth/cookie";
import { verifySessionToken } from "@/lib/auth/session";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  const raw = request.cookies.get(SESSION_COOKIE)?.value;
  const user = await verifySessionToken(raw);

  const path = request.nextUrl.pathname;
  const isLogin = path === "/login" || path.startsWith("/login/");
  const isHealth = path === "/api/health";
  const isPublicAuth =
    path === "/api/auth/register" || path === "/api/auth/login";

  if (isHealth) {
    return NextResponse.next();
  }

  const isApi = path.startsWith("/api/");
  if (!user && isApi && !isPublicAuth) {
    return jsonError(401, "UNAUTHORIZED", "Authentication required");
  }

  if (!user && !isLogin) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/login";
    redirectUrl.searchParams.set("next", path);
    return NextResponse.redirect(redirectUrl);
  }

  if (user && isLogin) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/";
    redirectUrl.search = "";
    return NextResponse.redirect(redirectUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
