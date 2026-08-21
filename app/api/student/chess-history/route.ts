import { NextResponse } from "next/server";
import { parseChessHistoryFilters } from "@/chess/history/history";
import { getStudentChessHistory } from "@/chess/persistence/historyServer";
import { requireActiveStudent, StudentAuthenticationError } from "@/lib/auth/requireActiveStudent";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const student = await requireActiveStudent();
    const filters = parseChessHistoryFilters(new URL(request.url).searchParams);
    return NextResponse.json(await getStudentChessHistory(student.studentId, filters));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Chess history could not be loaded.";
    return NextResponse.json(
      { error: message },
      { status: error instanceof StudentAuthenticationError ? 401 : 500 }
    );
  }
}
