import { NextResponse } from "next/server";
import { registrationClient, registrationOrigin } from "@/lib/auth/registration";

export const runtime = "nodejs";
export async function GET(request: Request) {
  try {
    const origin = registrationOrigin(request);
    const auth = await registrationClient();
    const { data, error } = await auth.client.auth.signInWithOAuth({ provider: "google", options: {
      redirectTo: `${origin}/api/auth/registration/callback`, skipBrowserRedirect: true,
      queryParams: { prompt: "select_account" }
    } });
    if (error || !data.url) throw new Error("Google login unavailable.");
    return auth.applyCookies(NextResponse.redirect(data.url));
  } catch {
    return NextResponse.redirect(new URL("/register?error=google", request.url));
  }
}
