import { NextResponse } from "next/server";
import { InternalArenaServerError, listStudentInternalArenas } from "@/chess/persistence/arenaServer";
import { requireActiveStudent, StudentAuthenticationError } from "@/lib/auth/requireActiveStudent";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const student = await requireActiveStudent();
    return NextResponse.json({ ok: true, arenas: await listStudentInternalArenas(student.studentId) });
  } catch (error) {
    const status = error instanceof StudentAuthenticationError ? 401 : error instanceof InternalArenaServerError ? error.status : 500;
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Internal Arenas could not be loaded." }, { status });
  }
}
