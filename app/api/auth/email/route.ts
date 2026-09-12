import { NextResponse } from "next/server";
import { registrationClient, registeredStudentSession, registrationOrigin, sameOriginRequest } from "@/lib/auth/registration";
import { allowAcademyLoginAttempt } from "@/lib/auth/academyLoginThrottle";

export const runtime = "nodejs";
export async function POST(request: Request) {
  const failure = (error: string, status = 400) => NextResponse.json({ error }, { status, headers: { "Cache-Control": "no-store" } });
  if (!sameOriginRequest(request)) return failure("Please use the sign-in form on this site.", 403);
  const ip = request.headers.get("x-vercel-forwarded-for") ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  if (!allowAcademyLoginAttempt(`email:${ip}`)) return failure("Too many attempts. Please try again later.", 429);
  if (Number(request.headers.get("content-length")) > 4096) return failure("Invalid details.");
  try {
    const raw = await request.text();
    if (raw.length > 4096) return failure("Invalid details.");
    let body;
    try { body = JSON.parse(raw); } catch { return failure("Invalid details."); }
    if (!body || !["register", "login"].includes(body.action) || typeof body.email !== "string" || typeof body.password !== "string") return failure("Invalid details.");
    const email = body.email.trim().toLowerCase();
    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || body.password.length > 256) return failure("Enter a valid email and password.");
    const auth = await registrationClient();
    if (body.action === "register") {
      if (body.password.length < 8) return failure("Use a password with at least 8 characters.");
      if (typeof body.nickname !== "string" || !body.nickname.trim() || body.nickname.trim().length > 40) return failure("Choose a nickname of 1–40 characters.");
      const { data, error } = await auth.client.auth.signUp({ email, password: body.password, options: {
        data: { nickname: body.nickname.trim() }, emailRedirectTo: `${registrationOrigin(request)}/api/auth/registration/callback`
      } });
      if (error) return failure(error.status === 429 ? "Too many requests. Please try again later." : "Registration could not be completed. Please try again or log in if you already have an account.", error.status === 429 ? 429 : 400);
      if (data.session && data.user?.email_confirmed_at) return auth.applyCookies(await registeredStudentSession(data.user, NextResponse.json({ ok: true })));
      return auth.applyCookies(NextResponse.json({ confirmationRequired: true, message: "Check your email to confirm your account. Open the confirmation link in this browser, then log in with your email and password." }));
    }
    const { data, error } = await auth.client.auth.signInWithPassword({ email, password: body.password });
    if (error || !data.user?.email_confirmed_at) return failure("Invalid email or password. If you just registered, confirm your email first.", 401);
    return auth.applyCookies(await registeredStudentSession(data.user, NextResponse.json({ ok: true })));
  } catch {
    return failure("We couldn’t complete that request. Please try again.", 503);
  }
}
