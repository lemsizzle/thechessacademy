import { NextRequest, NextResponse } from "next/server";
import { requirePuzzleStudent, saveCompletedWoodpeckerCycle } from "@/lib/puzzle-training/server";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const student = await requirePuzzleStudent();
    const body = await request.json() as { sessionId?: string; setSize?: number };
    if (!body.sessionId) return NextResponse.json({ error: "Session ID is required." }, { status: 400 });
    const stats = await saveCompletedWoodpeckerCycle(student.studentId, body.sessionId, body.setSize);
    return NextResponse.json({ stats });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Woodpecker cycle stats could not be saved.";
    const status = /log in|session|profile/i.test(message) ? 401 : /not complete|invalid|required/i.test(message) ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
