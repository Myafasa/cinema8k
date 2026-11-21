import { NextResponse, type NextRequest } from "next/server";
import { tenantSlugFromHost } from "@/lib/tenant-host";

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  // Internal rewritten URLs are not public entry points.
  if (pathname.startsWith("/%5Ftenant/") || pathname.startsWith("/_tenant/")) {
    return new NextResponse(null, { status: 404 });
  }
  if (
    pathname.startsWith("/_next/") ||
    pathname === "/favicon.ico" ||
    pathname.startsWith("/api/auth/") ||
    pathname === "/api/auth"
  ) {
    return NextResponse.next();
  }

  const slug = tenantSlugFromHost(request.nextUrl.hostname);
  if (!slug) return NextResponse.next();

  const url = request.nextUrl.clone();
  url.pathname = `/%5Ftenant/${slug}${pathname}`;
  url.search = search;
  return NextResponse.rewrite(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
