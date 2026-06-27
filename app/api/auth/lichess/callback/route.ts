import { LICHESS_OAUTH_CONTEXT_COOKIE, LICHESS_OAUTH_STATE_COOKIE, LICHESS_PKCE_COOKIE, LICHESS_TOKEN_COOKIE } from "@/lib/auth/roles";
import { findKnownLichessStudent } from "@/lib/auth/knownLichessStudents";
import { clearLichessOAuthCookies } from "@/lib/auth/lichessOAuth";
import { createStudentSession, setStudentSessionCookie } from "@/lib/auth/session";
import { fetchAuthenticatedLichessAccount } from "@/lib/lichess/fetchAccount";
import { encryptLichessToken } from "@/lib/lichess/tokenCrypto";
import { findStudentByLichess } from "@/lib/students/findStudentByLichess";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const cookieStore = await cookies();
  const expectedState = cookieStore.get(LICHESS_OAUTH_STATE_COOKIE)?.value;
  const verifier = cookieStore.get(LICHESS_PKCE_COOKIE)?.value;
  const contextRaw = cookieStore.get(LICHESS_OAUTH_CONTEXT_COOKIE)?.value;
  const context = contextRaw ? JSON.parse(contextRaw) as { redirectUri?: string; returnTo?: string; student?: string } : {};
  const safeReturnTo = context.returnTo?.startsWith("/") && !context.returnTo.startsWith("//") ? context.returnTo : "";
  const studentFromContext = context.student?.replace(/[^a-zA-Z0-9_-]/g, "") ?? "";

  if (!code || !state || !expectedState || state !== expectedState || !verifier) {
    const target = safeReturnTo ? new URL(safeReturnTo, url.origin) : new URL("/login?mode=student", url.origin);
    target.searchParams.set("lichess", "error");
    if (studentFromContext) target.searchParams.set("student", studentFromContext);
    const response = NextResponse.redirect(target);
    clearLichessOAuthCookies(response);
    return response;
  }

  try {
    const body = new URLSearchParams({
      grant_type: "authorization_code",
      code,
      code_verifier: verifier,
      redirect_uri: context.redirectUri || `${url.origin}/api/auth/lichess/callback`,
      client_id: process.env.LICHESS_CLIENT_ID ?? ""
    });
    if (process.env.LICHESS_CLIENT_SECRET) body.set("client_secret", process.env.LICHESS_CLIENT_SECRET);

    const tokenResponse = await fetch("https://lichess.org/api/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
      cache: "no-store"
    });
    if (!tokenResponse.ok) throw new Error("Token exchange failed");
    const token = await tokenResponse.json() as { access_token?: string; expires_in?: number; scope?: string };
    if (!token.access_token) throw new Error("Missing access token");

    const profile = await fetchAuthenticatedLichessAccount(token.access_token);
    const knownStudent = findKnownLichessStudent(cookieStore, profile.id, profile.username);
    const linkedStudent = findStudentByLichess(profile.id, profile.username);
    const studentId = knownStudent?.studentId ?? linkedStudent?.id ?? (studentFromContext || `lichess-${profile.id}`);
    const target = safeReturnTo
      ? new URL(safeReturnTo, url.origin)
      : new URL(knownStudent || linkedStudent ? "/student" : "/student/onboarding", url.origin);
    if (safeReturnTo) {
      target.searchParams.set("lichess", "connected");
      if (studentFromContext) target.searchParams.set("student", studentFromContext);
    }
    const response = NextResponse.redirect(target);

    setStudentSessionCookie(response, createStudentSession({
      studentId,
      name: knownStudent?.name ?? linkedStudent?.name ?? profile.username,
      lichessUserId: profile.id,
      lichessUsername: profile.username,
      onboardingCompleted: Boolean(knownStudent || linkedStudent)
    }));
    response.cookies.set(LICHESS_TOKEN_COOKIE, encryptLichessToken(token.access_token), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: Math.min(token.expires_in ?? 60 * 60 * 24 * 14, 60 * 60 * 24 * 14)
    });
    clearLichessOAuthCookies(response);
    return response;
  } catch {
    const target = safeReturnTo ? new URL(safeReturnTo, url.origin) : new URL("/login?mode=student", url.origin);
    target.searchParams.set("lichess", "error");
    if (studentFromContext) target.searchParams.set("student", studentFromContext);
    const response = NextResponse.redirect(target);
    clearLichessOAuthCookies(response);
    return response;
  }
}
