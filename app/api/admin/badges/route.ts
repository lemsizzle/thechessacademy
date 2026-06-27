import { ADMIN_SESSION_COOKIE, isValidAdminActionToken, isValidAdminSession } from "@/lib/auth/adminSession";
import { createAdminBadge, listAdminBadges } from "@/lib/badges/supabaseBadges";
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

  try {
    const badges = await listAdminBadges();
    return NextResponse.json({ badges });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load badges from Supabase.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!await isAuthorized(request)) return NextResponse.json({ error: "Teacher log in required." }, { status: 401 });

  try {
    const input = await request.json();
    const badge = await createAdminBadge(input);
    return NextResponse.json({ badge }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not create badge.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
