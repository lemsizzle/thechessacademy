import { ADMIN_SESSION_COOKIE, isValidAdminSession } from "@/lib/auth/adminSession";
import { NextResponse, type NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname === "/admin-login" || pathname.startsWith("/api/admin/")) {
    return NextResponse.next();
  }

  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    const allowed = await isValidAdminSession(request.cookies.get(ADMIN_SESSION_COOKIE)?.value);
    if (!allowed) {
      const target = new URL("/admin-login", request.url);
      target.searchParams.set("from", `${pathname}${request.nextUrl.search}`);
      return NextResponse.redirect(target);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*"]
};
