import { LICHESS_TOKEN_COOKIE } from "@/lib/auth/roles";
import { findKnownLichessStudent } from "@/lib/auth/knownLichessStudents";
import { buildPkceChallenge, createPkceVerifier, getLichessClientId, getLichessOAuthScopeParam, getLichessRedirectUri, setLichessOAuthCookies } from "@/lib/auth/lichessOAuth";
import { createStudentSession, setStudentSessionCookie } from "@/lib/auth/session";
import { createMockLichessProfile } from "@/lib/lichess/fetchAccount";
import { encryptLichessToken } from "@/lib/lichess/tokenCrypto";
import { findStudentByLichess } from "@/lib/students/findStudentByLichess";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

async function createMockLogin(request: Request, username: string) {
  const url = new URL(request.url);
  const returnTo = safeReturnTo(url.searchParams.get("returnTo"));
  const student = cleanToken(url.searchParams.get("student"));
  const profile = createMockLichessProfile(username);
  const knownStudent = findKnownLichessStudent(await cookies(), profile.id, profile.username);
  const linkedStudent = findStudentByLichess(profile.id, profile.username);
  const studentId = knownStudent?.studentId ?? linkedStudent?.id ?? student ?? `lichess-${profile.id}`;
  const target = returnTo
    ? withLichessStatus(new URL(returnTo, url.origin), "mock", student)
    : new URL(knownStudent || linkedStudent ? "/student" : "/student/onboarding", url.origin);
  const response = NextResponse.redirect(target);
  setStudentSessionCookie(response, createStudentSession({
    studentId,
    name: knownStudent?.name ?? linkedStudent?.name ?? profile.username,
    lichessUserId: profile.id,
    lichessUsername: profile.username,
    onboardingCompleted: Boolean(knownStudent || linkedStudent)
  }));
  response.cookies.set(LICHESS_TOKEN_COOKIE, encryptLichessToken(`mock-token-${profile.id}`), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 14
  });
  return response;
}

function cleanToken(value: string | null) {
  return value?.trim().replace(/[^a-zA-Z0-9_-]/g, "") || "";
}

function safeReturnTo(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "";
  return value;
}

function withLichessStatus(url: URL, status: "connected" | "mock" | "error", student?: string) {
  url.searchParams.set("lichess", status);
  if (student) url.searchParams.set("student", student);
  return url;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const mockUsername = url.searchParams.get("mock")?.trim().replace(/[^a-zA-Z0-9_-]/g, "") ?? "";
  const student = cleanToken(url.searchParams.get("student"));
  const returnTo = safeReturnTo(url.searchParams.get("returnTo"));

  if (mockUsername) {
    return createMockLogin(request, mockUsername);
  }

  const state = crypto.randomUUID();
  const verifier = createPkceVerifier();
  const challenge = await buildPkceChallenge(verifier);
  const redirectUri = getLichessRedirectUri(url.origin);
  const authUrl = new URL("https://lichess.org/oauth");
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("client_id", getLichessClientId());
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("scope", getLichessOAuthScopeParam());
  authUrl.searchParams.set("state", state);
  authUrl.searchParams.set("code_challenge_method", "S256");
  authUrl.searchParams.set("code_challenge", challenge);

  const response = NextResponse.redirect(authUrl);
  setLichessOAuthCookies(response, state, verifier, { redirectUri, student, returnTo });
  return response;
}
