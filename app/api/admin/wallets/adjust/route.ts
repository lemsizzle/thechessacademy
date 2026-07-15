import { ADMIN_SESSION_COOKIE, isValidAdminActionToken, isValidAdminSession } from "@/lib/auth/adminSession";
import { adjustStudentCoins } from "@/lib/avatar/supabaseAvatar";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

async function isAuthorized(request: Request) {
  const cookieStore = await cookies();
  const actionToken = request.headers.get("x-admin-action-token");
  return await isValidAdminSession(cookieStore.get(ADMIN_SESSION_COOKIE)?.value)
    || await isValidAdminActionToken(actionToken);
}

export async function POST(request: Request) {
  if (!await isAuthorized(request)) return NextResponse.json({ error: "Teacher log in required." }, { status: 401 });
  const body = await request.json().catch(() => ({})) as { studentId?: string; amount?: number; description?: string };
  if (!body.studentId) return NextResponse.json({ error: "Choose a student." }, { status: 400 });
  try {
    const wallet = await adjustStudentCoins(body.studentId, Number(body.amount), body.description ?? "Teacher Academy Coins adjustment");
    return NextResponse.json({ ok: true, wallet, message: "Academy Coins updated." });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not update Academy Coins.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
