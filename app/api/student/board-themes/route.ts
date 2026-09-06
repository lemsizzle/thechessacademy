import { NextResponse } from "next/server";
import { requireActiveStudent, StudentAuthenticationError } from "@/lib/auth/requireActiveStudent";
import { getStudentBoardThemes } from "@/lib/avatar/boardThemes";

export async function GET() {
  const headers = { "Cache-Control": "private, no-store" };
  try {
    const student = await requireActiveStudent();
    return NextResponse.json(await getStudentBoardThemes(student.studentId), { headers });
  } catch (error) {
    return NextResponse.json({ error: error instanceof StudentAuthenticationError ? "Student log in required." : "Could not load board themes." }, { status: error instanceof StudentAuthenticationError ? 401 : 503, headers });
  }
}
