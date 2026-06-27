import { ADMIN_SESSION_COOKIE } from "@/lib/auth/adminSession";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const response = NextResponse.redirect(new URL("/admin-login", request.url));
  response.cookies.delete(ADMIN_SESSION_COOKIE);
  return response;
}

export async function GET(request: Request) {
  return POST(request);
}
