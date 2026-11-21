import { NextResponse, type NextRequest } from "next/server";
import { tenantSlugFromHost } from "@/lib/tenant-host";

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  if (
    pathname.startsWith("/_next/") ||
    pathname === "/favicon.ico" ||
    pathname.startsWith("/api/auth/") ||
    pathname === "/api/auth"
  ) {
    return NextResponse.next();
  }

  const host = request.headers.get("host") ?? request.nextUrl.hostname;
  const slug = tenantSlugFromHost(host);
  if (!slug) return NextResponse.next();

  const url = request.nextUrl.clone();
  url.pathname = `/_tenant/${slug}${pathname}`;
  url.search = search;
  return NextResponse.rewrite(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
