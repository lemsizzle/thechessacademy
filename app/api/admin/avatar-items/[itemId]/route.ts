import { ADMIN_SESSION_COOKIE, isValidAdminActionToken, isValidAdminSession } from "@/lib/auth/adminSession";
import { updateAvatarItem } from "@/lib/avatar/supabaseAvatar";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ itemId: string }>;
};

async function isAuthorized(request: Request) {
  const cookieStore = await cookies();
  const actionToken = request.headers.get("x-admin-action-token");
  return await isValidAdminSession(cookieStore.get(ADMIN_SESSION_COOKIE)?.value)
    || await isValidAdminActionToken(actionToken);
}

export async function PATCH(request: Request, { params }: RouteContext) {
  if (!await isAuthorized(request)) return NextResponse.json({ error: "Teacher log in required." }, { status: 401 });
  const { itemId } = await params;
  try {
    const item = await updateAvatarItem(itemId, await request.json());
    return NextResponse.json({ item });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not update avatar item.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
