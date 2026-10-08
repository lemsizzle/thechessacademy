import { NextResponse } from "next/server";
import { requireActiveStudent, StudentAuthenticationError } from "@/lib/auth/requireActiveStudent";
import { ComputerPresenceError } from "@/chess/live/computerPresence";
import { publishComputerGamePresence } from "@/chess/persistence/computerGamePresenceServer";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const student = await requireActiveStudent();
    // Compact UCI history is bounded; this endpoint never awards XP or saves finished games.
    const text = await request.text();
    if (text.length > 16_000) throw new ComputerPresenceError("Invalid computer game snapshot.");
    let body: unknown;
    try { body = JSON.parse(text); } catch { throw new ComputerPresenceError("Invalid computer game snapshot."); }
    const result = await publishComputerGamePresence(student.studentId, body);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const status = error instanceof StudentAuthenticationError ? 401 : error instanceof ComputerPresenceError ? error.status : 500;
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Computer game could not be shared." }, { status });
  }
}
