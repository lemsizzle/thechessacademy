import "server-only";
import { createClient, type User } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getSupabaseServiceClient } from "@/lib/supabase/server";
import { createStudentSession, setStudentSessionCookie } from "@/lib/auth/session";
import { LICHESS_TOKEN_COOKIE } from "@/lib/auth/roles";

const PKCE_COOKIE = "quest_board_registration_pkce";
const STORAGE_KEY = "quest-board-registration";

/** Request-scoped Auth client. Only the PKCE verifier crosses requests, in an HttpOnly cookie. */
export async function registrationClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("Registration is not configured.");
  const jar = await cookies();
  const memory = new Map<string, string>();
  const verifierKey = `${STORAGE_KEY}-code-verifier`;
  const previous = jar.get(PKCE_COOKIE)?.value;
  if (previous) memory.set(verifierKey, previous);
  let changed = false;
  const client = createClient(url, key, { auth: {
    flowType: "pkce", storageKey: STORAGE_KEY, persistSession: true,
    autoRefreshToken: false, detectSessionInUrl: false,
    storage: {
      getItem: (key) => memory.get(key) ?? null,
      setItem: (key, value) => { memory.set(key, value); if (key === verifierKey) changed = true; },
      removeItem: (key) => { memory.delete(key); if (key === verifierKey) changed = true; }
    }
  } });
  return { client, applyCookies(response: NextResponse) {
    response.headers.set("Cache-Control", "private, no-store");
    if (changed) {
      const verifier = memory.get(verifierKey);
      if (verifier) response.cookies.set(PKCE_COOKIE, verifier, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 3600 });
      else response.cookies.delete(PKCE_COOKIE);
    }
    return response;
  } };
}

export function registrationOrigin(request: Request) {
  const url = new URL(request.url);
  const host = request.headers.get("host") ?? url.host;
  const protocol = request.headers.get("x-forwarded-proto") ?? url.protocol.slice(0, -1);
  const origin = `${protocol}://${host}`;
  const allowed = ["https://chessquest.app", "https://www.chessquest.app", "https://thechessacademy.vercel.app"];
  if (process.env.NODE_ENV !== "production" && /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host)) return origin;
  if (!allowed.includes(origin)) throw new Error("Unsupported registration origin.");
  return origin;
}

export function sameOriginRequest(request: Request) {
  try { return request.headers.get("origin") === registrationOrigin(request); } catch { return false; }
}

export async function registeredStudentSession(user: User, response: NextResponse) {
  if (!user.email_confirmed_at) throw new Error("Confirm your email first.");
  const db = getSupabaseServiceClient();
  if (!db) throw new Error("Student storage unavailable.");
  // Metadata supplies display text only, never a role, student ID, or existing-account match.
  const nickname = typeof user.user_metadata?.nickname === "string" ? user.user_metadata.nickname.trim().slice(0, 40) : "Chess Explorer";
  const result = await db.rpc("provision_registered_student", { p_auth_user_id: user.id, p_nickname: nickname || "Chess Explorer" });
  if (result.error || !result.data?.[0]) throw new Error("Could not open student profile.");
  const student = result.data[0] as { student_id: string; display_name: string };
  setStudentSessionCookie(response, createStudentSession({ authProvider: "supabase", authUserId: user.id,
    studentId: student.student_id, name: student.display_name, onboardingCompleted: true }));
  response.cookies.delete(LICHESS_TOKEN_COOKIE);
  response.cookies.delete(PKCE_COOKIE);
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
