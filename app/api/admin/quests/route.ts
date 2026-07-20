import { ADMIN_SESSION_COOKIE, isValidAdminActionToken, isValidAdminSession } from "@/lib/auth/adminSession";
import { listAdminQuests, saveAdminQuest } from "@/lib/quests/supabaseQuests";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

async function isAuthorized(request: Request) {
  const cookieStore = await cookies();
  return await isValidAdminSession(cookieStore.get(ADMIN_SESSION_COOKIE)?.value)
    || await isValidAdminActionToken(request.headers.get("x-admin-action-token"));
}

export async function GET(request: Request) {
  if (!await isAuthorized(request)) return NextResponse.json({ error: "Teacher log in required." }, { status: 401 });
  try {
    return NextResponse.json({ quests: await listAdminQuests() });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not load quests." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!await isAuthorized(request)) return NextResponse.json({ error: "Teacher log in required." }, { status: 401 });
  try {
    const quest = await saveAdminQuest(await request.json());
    return NextResponse.json({ quest });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not save quest." }, { status: 400 });
  }
}
