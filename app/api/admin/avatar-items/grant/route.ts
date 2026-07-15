import { ADMIN_SESSION_COOKIE, isValidAdminActionToken, isValidAdminSession } from "@/lib/auth/adminSession";
import { grantAvatarItem } from "@/lib/avatar/supabaseAvatar";
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
  const body = await request.json().catch(() => ({})) as { studentId?: string; itemId?: string };
  if (!body.studentId || !body.itemId) return NextResponse.json({ error: "Choose a student and item." }, { status: 400 });
  try {
    const inventory = await grantAvatarItem(body.studentId, body.itemId, "admin_grant");
    return NextResponse.json({ ok: true, inventory, message: "Avatar item granted." });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not grant avatar item.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
