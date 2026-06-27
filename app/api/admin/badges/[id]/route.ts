import { ADMIN_SESSION_COOKIE, isValidAdminActionToken, isValidAdminSession } from "@/lib/auth/adminSession";
import { deleteAdminBadge, updateAdminBadge } from "@/lib/badges/supabaseBadges";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string }>;
};

async function isAuthorized(request: Request) {
  const cookieStore = await cookies();
  const actionToken = request.headers.get("x-admin-action-token");
  return await isValidAdminSession(cookieStore.get(ADMIN_SESSION_COOKIE)?.value)
    || await isValidAdminActionToken(actionToken);
}

export async function PATCH(request: Request, { params }: RouteContext) {
  if (!await isAuthorized(request)) return NextResponse.json({ error: "Teacher log in required." }, { status: 401 });

  const { id } = await params;
  if (!id) return NextResponse.json({ error: "Missing badge id." }, { status: 400 });

  try {
    const input = await request.json();
    const badge = await updateAdminBadge(id, input);
    return NextResponse.json({ badge });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not update badge.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(request: Request, { params }: RouteContext) {
  if (!await isAuthorized(request)) return NextResponse.json({ error: "Teacher log in required." }, { status: 401 });

  const { id } = await params;
  if (!id) return NextResponse.json({ error: "Missing badge id." }, { status: 400 });

  try {
    const result = await deleteAdminBadge(id);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not delete badge.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
