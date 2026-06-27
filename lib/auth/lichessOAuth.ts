import { LICHESS_OAUTH_CONTEXT_COOKIE, LICHESS_OAUTH_STATE_COOKIE, LICHESS_PKCE_COOKIE } from "@/lib/auth/roles";
import { NextResponse } from "next/server";

function base64Url(bytes: Uint8Array) {
  return Buffer.from(bytes).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export function hasLichessOAuthConfig() {
  const clientId = process.env.LICHESS_CLIENT_ID?.trim();
  if (!clientId || clientId === "chess-academy-quest-board" || clientId === "change-me") return false;
  if (process.env.NODE_ENV === "production" && !process.env.LICHESS_ENCRYPTION_SECRET) return false;
  return true;
}

export function getLichessClientId() {
  return process.env.LICHESS_CLIENT_ID?.trim() || "the-chess-academy-quest-board-local";
}

const DEFAULT_LICHESS_OAUTH_SCOPES = [
  "puzzle:read",
  "team:read"
] as const;

export function getLichessOAuthScopes() {
  const configured = process.env.LICHESS_OAUTH_SCOPES?.trim();
  if (!configured) return [...DEFAULT_LICHESS_OAUTH_SCOPES];
  return configured.split(/[\s,]+/).map((scope) => scope.trim()).filter(Boolean);
}

export function getLichessOAuthScopeParam() {
  return getLichessOAuthScopes().join(" ");
}

export async function buildPkceChallenge(verifier: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return base64Url(new Uint8Array(digest));
}

export function createPkceVerifier() {
  return base64Url(crypto.getRandomValues(new Uint8Array(64)));
}

export function setLichessOAuthCookies(response: NextResponse, state: string, verifier: string, context: Record<string, string>) {
  const options = { httpOnly: true, sameSite: "lax" as const, secure: process.env.NODE_ENV === "production", path: "/", maxAge: 600 };
  response.cookies.set(LICHESS_OAUTH_STATE_COOKIE, state, options);
  response.cookies.set(LICHESS_PKCE_COOKIE, verifier, options);
  response.cookies.set(LICHESS_OAUTH_CONTEXT_COOKIE, JSON.stringify(context), options);
}

export function clearLichessOAuthCookies(response: NextResponse) {
  response.cookies.delete(LICHESS_OAUTH_STATE_COOKIE);
  response.cookies.delete(LICHESS_PKCE_COOKIE);
  response.cookies.delete(LICHESS_OAUTH_CONTEXT_COOKIE);
}

function isLocalhostUrl(value: string) {
  try {
    const url = new URL(value);
    return url.hostname === "localhost" || url.hostname === "127.0.0.1";
  } catch {
    return false;
  }
}

function getAppOrigin(fallbackOrigin: string) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (!appUrl) return fallbackOrigin;

  try {
    return new URL(appUrl).origin;
  } catch {
    return fallbackOrigin;
  }
}

export function getLichessRedirectUri(origin: string) {
  const configured = process.env.LICHESS_REDIRECT_URI?.trim();
  if (configured && (process.env.NODE_ENV !== "production" || !isLocalhostUrl(configured))) {
    return configured;
  }

  return `${getAppOrigin(origin)}/api/auth/lichess/callback`;
}

export function getMissingLichessOAuthConfig(origin: string) {
  const missing: string[] = [];
  const clientId = process.env.LICHESS_CLIENT_ID?.trim();
  const redirectUri = getLichessRedirectUri(origin);

  if (!clientId || clientId === "chess-academy-quest-board" || clientId === "change-me") {
    missing.push("LICHESS_CLIENT_ID");
  }

  if (process.env.NODE_ENV === "production" && !process.env.NEXT_PUBLIC_APP_URL?.trim() && !process.env.LICHESS_REDIRECT_URI?.trim()) {
    missing.push("NEXT_PUBLIC_APP_URL or LICHESS_REDIRECT_URI");
  }

  if (process.env.NODE_ENV === "production" && !process.env.LICHESS_ENCRYPTION_SECRET?.trim()) {
    missing.push("LICHESS_ENCRYPTION_SECRET");
  }

  if (process.env.NODE_ENV === "production" && isLocalhostUrl(redirectUri)) {
    missing.push("production LICHESS_REDIRECT_URI must not be localhost");
  }

  return missing;
}
