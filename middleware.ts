import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const search = request.nextUrl.search;
  const referer = request.headers.get("referer");
  // #region agent log
  fetch("http://127.0.0.1:7792/ingest/18dde792-c522-4d1c-b861-703aa48af361", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Debug-Session-Id": "17c0f4",
    },
    body: JSON.stringify({
      sessionId: "17c0f4",
      runId: "pre-fix",
      hypothesisId: "H1-H5",
      location: "middleware.ts:middleware",
      message: "incoming_request",
      data: {
        pathname,
        search,
        refererSnippet: referer ? referer.slice(0, 120) : null,
      },
      timestamp: Date.now(),
    }),
  }).catch(() => {});
  // #endregion
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
