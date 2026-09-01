import { ADMIN_SESSION_COOKIE, isValidAdminActionToken, isValidAdminSession } from "@/lib/auth/adminSession";
import { deleteAdminQuest, setAdminQuestActive } from "@/lib/quests/supabaseQuests";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

async function isAuthorized(request: Request) {
  const cookieStore = await cookies();
  return await isValidAdminSession(cookieStore.get(ADMIN_SESSION_COOKIE)?.value)
    || await isValidAdminActionToken(request.headers.get("x-admin-action-token"));
}

export async function DELETE(request: Request, { params }: RouteContext) {
  if (!await isAuthorized(request)) return NextResponse.json({ error: "Teacher log in required." }, { status: 401 });
  try {
    const { id } = await params;
    await deleteAdminQuest(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not delete quest." }, { status: 400 });
  }
}

export async function PATCH(request: Request, { params }: RouteContext) {
  if (!await isAuthorized(request)) return NextResponse.json({ error: "Teacher log in required." }, { status: 401 });

  try {
    const { id } = await params;
    const body = await request.json() as { isActive?: unknown };
    if (typeof body.isActive !== "boolean") {
      return NextResponse.json({ error: "isActive must be true or false." }, { status: 400 });
    }

    const quest = await setAdminQuestActive(id, body.isActive);
    return NextResponse.json({ quest });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not update quest." }, { status: 400 });
  }
}
