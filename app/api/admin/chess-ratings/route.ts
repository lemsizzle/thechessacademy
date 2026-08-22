import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { ADMIN_SESSION_COOKIE, isValidAdminActionToken, isValidAdminSession } from "@/lib/auth/adminSession";
import { adjustStudentChessRating, ChessRatingServerError, listChessRatings } from "@/chess/persistence/ratingServer";

export const dynamic = "force-dynamic";

async function authorized(request: Request) {
  const cookieStore = await cookies();
  return await isValidAdminSession(cookieStore.get(ADMIN_SESSION_COOKIE)?.value)
    || await isValidAdminActionToken(request.headers.get("x-admin-action-token"));
}

export async function GET(request: Request) {
  if (!await authorized(request)) return NextResponse.json({ ok: false, error: "Teacher log in required." }, { status: 401 });
  try {
    return NextResponse.json({ ok: true, ratings: await listChessRatings() });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Ratings could not be loaded." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!await authorized(request)) return NextResponse.json({ ok: false, error: "Teacher log in required." }, { status: 401 });
  try {
    const body = await request.json().catch(() => ({})) as { studentId?: string; rating?: number; reason?: string };
    if (!body.studentId) throw new ChessRatingServerError("Choose a student.");
    const adjustment = await adjustStudentChessRating(body.studentId, Number(body.rating), body.reason ?? "");
    return NextResponse.json({ ok: true, adjustment, message: "Chess rating updated." });
  } catch (error) {
    const status = error instanceof ChessRatingServerError ? error.status : 500;
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Rating could not be updated." }, { status });
  }
}
