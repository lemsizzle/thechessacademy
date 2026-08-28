import { ADMIN_SESSION_COOKIE, isAuthorizedAdminRequest } from "@/lib/auth/adminSession";
import { syncTeamTournaments } from "@/lib/lichess/syncTeamTournaments";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const cookieStore = await cookies();
  if (!await isAuthorizedAdminRequest(cookieStore.get(ADMIN_SESSION_COOKIE)?.value, request.headers.get("x-admin-action-token"))) {
    return NextResponse.json({ error: "Teacher log in required." }, { status: 401 });
  }

  const result = await syncTeamTournaments({ force: true });
  return NextResponse.json({ ...result, createdBy: process.env.LICHESS_TOURNAMENT_CREATED_BY });
}
