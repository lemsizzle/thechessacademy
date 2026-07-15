import { ADMIN_SESSION_COOKIE, isValidAdminActionToken, isValidAdminSession } from "@/lib/auth/adminSession";
import { createAvatarItem, listAvatarItems } from "@/lib/avatar/supabaseAvatar";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

async function isAuthorized(request: Request) {
  const cookieStore = await cookies();
  const actionToken = request.headers.get("x-admin-action-token");
  return await isValidAdminSession(cookieStore.get(ADMIN_SESSION_COOKIE)?.value)
    || await isValidAdminActionToken(actionToken);
}

export async function GET(request: Request) {
  if (!await isAuthorized(request)) return NextResponse.json({ error: "Teacher log in required." }, { status: 401 });
  const items = await listAvatarItems({ includeInactive: true, useService: true });
  return NextResponse.json({ items });
}

export async function POST(request: Request) {
  if (!await isAuthorized(request)) return NextResponse.json({ error: "Teacher log in required." }, { status: 401 });
  try {
    const item = await createAvatarItem(await request.json());
    return NextResponse.json({ item }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not create avatar item.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
