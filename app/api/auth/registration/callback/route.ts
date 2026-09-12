import { NextResponse } from "next/server";
import { registrationClient, registeredStudentSession, registrationOrigin } from "@/lib/auth/registration";

export const runtime = "nodejs";
export async function GET(request: Request) {
  const url = new URL(request.url);
  try {
    const origin = registrationOrigin(request);
    const code = url.searchParams.get("code");
    if (!code || code.length > 2048 || url.searchParams.has("error")) throw new Error("Invalid callback.");
    const auth = await registrationClient();
    const { data, error } = await auth.client.auth.exchangeCodeForSession(code);
    if (error || !data.session) throw new Error("Invalid or expired code.");
    const verified = await auth.client.auth.getUser(data.session.access_token);
    if (verified.error || !verified.data.user) throw new Error("User could not be verified.");
    return auth.applyCookies(await registeredStudentSession(verified.data.user, NextResponse.redirect(`${origin}/student`)));
  } catch {
    return NextResponse.redirect(new URL("/register?error=confirmation", request.url));
  }
}
