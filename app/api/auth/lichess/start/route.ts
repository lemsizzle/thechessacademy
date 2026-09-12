import { buildPkceChallenge, createPkceVerifier, getLichessClientId, getLichessOAuthScopeParam, getLichessRedirectUri, getMissingLichessOAuthConfig, hasLichessOAuthConfig, setLichessOAuthCookies } from "@/lib/auth/lichessOAuth";
import { NextResponse } from "next/server";
import { requireActiveStudent } from "@/lib/auth/requireActiveStudent";

export const dynamic = "force-dynamic";

function cleanToken(value: string | null) {
  return value?.trim().replace(/[^a-zA-Z0-9_-]/g, "") || "";
}

function safeReturnTo(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "";
  return value;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const student = cleanToken(url.searchParams.get("student"));
  const returnTo = safeReturnTo(url.searchParams.get("returnTo"));
  const retry = url.searchParams.get("retry") === "1" ? "1" : "";
  let linkStudentId = "";
  if (url.searchParams.get("link") === "1") {
    try {
      const session = await requireActiveStudent();
      if ((session.authProvider !== "academy" && session.authProvider !== "supabase")) return NextResponse.redirect(new URL("/student", url.origin));
      linkStudentId = session.studentId;
    } catch { return NextResponse.redirect(new URL("/login", url.origin)); }
  }

  if (process.env.NODE_ENV === "production" && !hasLichessOAuthConfig()) {
    const target = new URL("/login", url.origin);
    target.searchParams.set("mode", "student");
    target.searchParams.set("lichess", "missing-config");
    target.searchParams.set("missing", getMissingLichessOAuthConfig(url.origin).join(","));
    return NextResponse.redirect(target);
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
  setLichessOAuthCookies(response, state, verifier, { redirectUri, student, returnTo, retry, linkStudentId });
  return response;
}
