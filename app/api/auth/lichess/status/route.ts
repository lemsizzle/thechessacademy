import { getLichessClientId, getLichessOAuthScopes, getLichessRedirectUri, getMissingLichessOAuthConfig, hasLichessOAuthConfig } from "@/lib/auth/lichessOAuth";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const missing = getMissingLichessOAuthConfig(url.origin);
  const configured = hasLichessOAuthConfig();

  return NextResponse.json({
    configured,
    willOpenLichess: configured,
    clientId: getLichessClientId(),
    callbackUrl: getLichessRedirectUri(url.origin),
    scopes: getLichessOAuthScopes(),
    missing
  });
}
