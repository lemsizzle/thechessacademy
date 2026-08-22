import { NextResponse } from "next/server";
import type { MistakePuzzle } from "@/chess/analysis/mistakes";
import { saveAdaptiveReviewItems } from "@/chess/training/adaptiveReviewServer";
import { requireActiveStudent, StudentAuthenticationError } from "@/lib/auth/requireActiveStudent";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const student = await requireActiveStudent();
    const body = await request.json() as { gameId?: string; puzzles?: MistakePuzzle[] };
    if (!body.gameId || !Array.isArray(body.puzzles)) {
      return NextResponse.json({ error: "Game id and review positions are required." }, { status: 400 });
    }
    return NextResponse.json(await saveAdaptiveReviewItems(student.studentId, body.gameId, body.puzzles));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Review positions could not be saved.";
    const status = error instanceof StudentAuthenticationError ? 401 : /invalid|not found|too many|required/i.test(message) ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
