import { NextRequest, NextResponse } from "next/server";
import { StudentAuthenticationError } from "@/lib/auth/requireActiveStudent";
import { WOODPECKER_CYCLE_COUNT } from "@/lib/puzzle-training/modes";
import { requirePuzzleStudent, saveCompletedWoodpeckerCycle, saveCompletedWoodpeckerSet } from "@/lib/puzzle-training/server";
import { CONQUER_WOODPECKER_SET_SIZE } from "@/lib/puzzle-training/woodpeckerSet";

export const dynamic = "force-dynamic";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request: NextRequest) {
  try {
    const student = await requirePuzzleStudent();
    const body = await request.json() as {
      sessionId?: string;
      setSize?: number;
      runId?: string;
      cycleNumber?: number;
      cycleSessionIds?: unknown;
    };
    if (!body.sessionId) return NextResponse.json({ error: "Session ID is required." }, { status: 400 });
    if (body.cycleNumber !== undefined
      && (!Number.isInteger(body.cycleNumber) || body.cycleNumber < 1 || body.cycleNumber > WOODPECKER_CYCLE_COUNT)) {
      return NextResponse.json({ error: "Cycle number is invalid." }, { status: 400 });
    }
    const hasCycleIdentity = body.runId !== undefined || body.cycleNumber !== undefined || body.cycleSessionIds !== undefined;
    if (hasCycleIdentity) {
      const cycleSessionIds = Array.isArray(body.cycleSessionIds) ? body.cycleSessionIds : [];
      if (!body.runId
        || !UUID_PATTERN.test(body.runId)
        || body.cycleNumber === undefined
        || cycleSessionIds.length !== body.cycleNumber
        || new Set(cycleSessionIds).size !== cycleSessionIds.length
        || cycleSessionIds.some((sessionId) => typeof sessionId !== "string" || !UUID_PATTERN.test(sessionId))
        || cycleSessionIds[cycleSessionIds.length - 1] !== body.sessionId) {
        return NextResponse.json({ error: "Valid ordered Woodpecker cycle details are required." }, { status: 400 });
      }
    }
    const cycleSessionIds = Array.isArray(body.cycleSessionIds) ? body.cycleSessionIds as string[] : [];
    const cycleIdentity = body.runId && body.cycleNumber
      ? { runId: body.runId, cycleNumber: body.cycleNumber }
      : undefined;
    const stats = await saveCompletedWoodpeckerCycle(student.studentId, body.sessionId, body.setSize, cycleIdentity);
    const completesQuestSet = body.cycleNumber === WOODPECKER_CYCLE_COUNT
      && body.setSize === CONQUER_WOODPECKER_SET_SIZE;
    let setCompleted = false;
    if (completesQuestSet && body.runId) {
      await saveCompletedWoodpeckerSet({
        studentId: student.studentId,
        runId: body.runId,
        cycleSessionIds
      });
      setCompleted = true;
    }
    return NextResponse.json({ stats, setCompleted });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Woodpecker cycle stats could not be saved.";
    const status = error instanceof StudentAuthenticationError
      ? 401
      : /not complete|invalid|required|requires|must|different|immutable/i.test(message)
        ? 400
        : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
