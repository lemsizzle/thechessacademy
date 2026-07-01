import { LICHESS_TOKEN_COOKIE } from "@/lib/auth/roles";
import { buildPkceChallenge, createPkceVerifier, getLichessClientId, getLichessOAuthScopeParam, getLichessRedirectUri, getMissingLichessOAuthConfig, hasLichessOAuthConfig, setLichessOAuthCookies } from "@/lib/auth/lichessOAuth";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function cleanToken(value: string | null) {
  return value?.trim().replace(/[^a-zA-Z0-9_-]/g, "") || "";
}

function safeReturnTo(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "";
  return value;
}

function withLichessStatus(url: URL, status: "connected" | "error", student?: string) {
  url.searchParams.set("lichess", status);
  if (student) url.searchParams.set("student", student);
  return url;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const student = cleanToken(url.searchParams.get("student"));
  const returnTo = safeReturnTo(url.searchParams.get("returnTo"));
  const retry = url.searchParams.get("retry") === "1" ? "1" : "";

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
  setLichessOAuthCookies(response, state, verifier, { redirectUri, student, returnTo, retry });
  return response;
}
