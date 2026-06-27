import { LICHESS_OAUTH_CONTEXT_COOKIE, LICHESS_OAUTH_STATE_COOKIE, LICHESS_PKCE_COOKIE } from "@/lib/auth/roles";
import { NextResponse } from "next/server";

function base64Url(bytes: Uint8Array) {
  return Buffer.from(bytes).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export function hasLichessOAuthConfig() {
  const clientId = process.env.LICHESS_CLIENT_ID?.trim();
  if (!clientId || clientId === "chess-academy-quest-board" || clientId === "change-me") return false;
  if (process.env.NODE_ENV !== "production" && !process.env.LICHESS_REDIRECT_URI) return false;
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

export function getLichessRedirectUri(origin: string) {
  return process.env.LICHESS_REDIRECT_URI || `${origin}/api/auth/lichess/callback`;
}
