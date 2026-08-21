import { NextResponse } from "next/server";
import { requireActiveStudent, StudentAuthenticationError } from "@/lib/auth/requireActiveStudent";
import { saveCompletedGame } from "@/chess/persistence/saveCompletedGame";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const student = await requireActiveStudent();
    const body = await request.json().catch(() => null);
    const saved = await saveCompletedGame(student.studentId, body);
    return NextResponse.json({ ok: true, gameId: saved.id }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Completed game could not be saved.";
    const status = error instanceof StudentAuthenticationError ? 401 : message.startsWith("Invalid") || message.startsWith("Illegal") || message.includes("does not match") ? 400 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
