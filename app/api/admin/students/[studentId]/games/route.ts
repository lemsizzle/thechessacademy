import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { ADMIN_SESSION_COOKIE, isAuthorizedAdminRequest } from "@/lib/auth/adminSession";
import { getRecentStudentGames } from "@/chess/persistence/historyServer";

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ studentId: string }> }) {
  const cookieStore = await cookies();
  if (!await isAuthorizedAdminRequest(cookieStore.get(ADMIN_SESSION_COOKIE)?.value, request.headers.get("x-admin-action-token"))) {
    return NextResponse.json({ error: "Teacher log in required." }, { status: 401 });
  }
  const { studentId } = await params;
  const page = Number(new URL(request.url).searchParams.get("page") ?? 1);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(studentId) || !Number.isInteger(page) || page < 1 || page > 10000) {
    return NextResponse.json({ error: "Invalid student or page." }, { status: 400 });
  }
  try {
    return NextResponse.json(await getRecentStudentGames(studentId, page), { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json({ error: "Recent games could not be loaded. Please retry." }, { status: 500 });
  }
}
