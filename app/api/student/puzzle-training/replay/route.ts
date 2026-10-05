import { NextRequest, NextResponse } from "next/server";
import { StudentAuthenticationError } from "@/lib/auth/requireActiveStudent";
import { hasPuzzleHistory } from "@/lib/puzzle-training/dashboardServer";
import { preparePublicTrainingPuzzle } from "@/lib/puzzle-training/publicPuzzle";
import { getTrainingPuzzle, requirePuzzleStudent } from "@/lib/puzzle-training/server";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const student = await requirePuzzleStudent();
    const body: unknown = await request.json().catch(() => null);
    const puzzleId = body && typeof body === "object" && "puzzleId" in body ? body.puzzleId : null;
    if (typeof puzzleId !== "string") return NextResponse.json({ error: "Choose a puzzle from your history." }, { status: 400 });
    if (!await hasPuzzleHistory(student.studentId, puzzleId)) return NextResponse.json({ error: "Puzzle not found in your history." }, { status: 404 });
    const puzzle = await getTrainingPuzzle(puzzleId);
    if (!puzzle) return NextResponse.json({ error: "This puzzle is no longer available." }, { status: 404 });
    return NextResponse.json({ puzzle: preparePublicTrainingPuzzle({
      puzzle, studentId: student.studentId, sessionId: crypto.randomUUID(), selectedTheme: "mixed",
      trainingMode: "legacy", dashboardReplay: true
    }) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    const unauthorized = error instanceof StudentAuthenticationError;
    return NextResponse.json({ error: unauthorized ? "Please log in to replay your puzzles." : "Could not start this replay. Please try again." }, { status: unauthorized ? 401 : 503 });
  }
}
