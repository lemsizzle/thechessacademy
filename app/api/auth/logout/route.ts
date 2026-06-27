import { LICHESS_TOKEN_COOKIE } from "@/lib/auth/roles";
import { clearStudentSessionCookie } from "@/lib/auth/session";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  clearStudentSessionCookie(response);
  response.cookies.delete(LICHESS_TOKEN_COOKIE);
  response.cookies.delete("lichess_access_token");
  return response;
}

export async function GET(request: Request) {
  const response = NextResponse.redirect(new URL("/login", request.url));
  clearStudentSessionCookie(response);
  response.cookies.delete(LICHESS_TOKEN_COOKIE);
  response.cookies.delete("lichess_access_token");
  return response;
}
