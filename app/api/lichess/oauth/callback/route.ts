import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { LICHESS_TOKEN_COOKIE } from "@/lib/auth/roles";
import { encryptLichessToken } from "@/lib/lichess/tokenCrypto";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const cookieStore = await cookies();
  const expectedState = cookieStore.get("lichess_oauth_state")?.value;
  const verifier = cookieStore.get("lichess_pkce_verifier")?.value;
  const context = cookieStore.get("lichess_oauth_context")?.value;
  let returnTo = "/admin/students";
  let student = "";
  try {
    const parsed = context ? JSON.parse(context) as { returnTo?: string; student?: string } : {};
    returnTo = parsed.returnTo?.startsWith("/") ? parsed.returnTo : returnTo;
    student = parsed.student ?? "";
  } catch {
    returnTo = "/admin/students";
  }
  const redirect = new URL(returnTo, url.origin);
  redirect.searchParams.set("lichess", "connected");
  if (student) redirect.searchParams.set("student", student);

  if (!code || !state || !expectedState || state !== expectedState || !verifier) {
    const errorRedirect = new URL(returnTo, url.origin);
    errorRedirect.searchParams.set("lichess", "error");
    if (student) errorRedirect.searchParams.set("student", student);
    return NextResponse.redirect(errorRedirect);
  }

  const clientId = process.env.LICHESS_CLIENT_ID ?? "chess-academy-quest-board";
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    code_verifier: verifier,
    redirect_uri: `${url.origin}/api/lichess/oauth/callback`,
    client_id: clientId
  });

  try {
    const tokenResponse = await fetch("https://lichess.org/api/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
      cache: "no-store"
    });

    if (!tokenResponse.ok) throw new Error("Token exchange failed");
    const token = await tokenResponse.json() as { access_token?: string; expires_in?: number };
    if (!token.access_token) throw new Error("Missing access token");

    const response = NextResponse.redirect(redirect);
    response.cookies.set(LICHESS_TOKEN_COOKIE, encryptLichessToken(token.access_token), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: Math.min(token.expires_in ?? 3600, 3600)
    });
    response.cookies.delete("lichess_oauth_state");
    response.cookies.delete("lichess_oauth_context");
    response.cookies.delete("lichess_pkce_verifier");
    return response;
  } catch {
    const mockRedirect = new URL(returnTo, url.origin);
    mockRedirect.searchParams.set("lichess", "mock");
    if (student) mockRedirect.searchParams.set("student", student);
    const response = NextResponse.redirect(mockRedirect);
    response.cookies.delete("lichess_oauth_state");
    response.cookies.delete("lichess_oauth_context");
    response.cookies.delete("lichess_pkce_verifier");
    return response;
  }
}
