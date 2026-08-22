import { NextResponse } from "next/server";
import { requireActiveStudent, StudentAuthenticationError } from "@/lib/auth/requireActiveStudent";
import { ChessRatingServerError, getStudentChessRatingDashboard } from "@/chess/persistence/ratingServer";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const student = await requireActiveStudent();
    return NextResponse.json({ ok: true, dashboard: await getStudentChessRatingDashboard(student.studentId) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Chess ratings could not be loaded.";
    const status = error instanceof StudentAuthenticationError ? 401 : error instanceof ChessRatingServerError ? error.status : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
