import { getLichessClientId, getLichessOAuthScopes, getLichessRedirectUri, hasLichessOAuthConfig } from "@/lib/auth/lichessOAuth";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const clientId = process.env.LICHESS_CLIENT_ID?.trim() ?? "";
  const configured = hasLichessOAuthConfig();

  return NextResponse.json({
    configured,
    willOpenLichess: true,
    clientId: getLichessClientId(),
    callbackUrl: getLichessRedirectUri(url.origin),
    scopes: getLichessOAuthScopes(),
    missing: [
      clientId ? "" : "LICHESS_CLIENT_ID",
      process.env.LICHESS_REDIRECT_URI ? "" : "LICHESS_REDIRECT_URI",
      process.env.LICHESS_ENCRYPTION_SECRET ? "" : "LICHESS_ENCRYPTION_SECRET"
    ].filter(Boolean)
  });
}
