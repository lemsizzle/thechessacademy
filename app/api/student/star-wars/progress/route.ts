import { NextRequest, NextResponse } from "next/server";
import {
  StarWarsInputError,
  isStarWarsAuthenticationError,
  requireStarWarsStudent,
  saveStarWarsProgress
} from "@/lib/puzzle-training/starWarsServer";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const value = await request.json() as unknown;
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new StarWarsInputError("The Star Wars score request must be a JSON object.");
    }
    const body = value as { runId?: unknown; startScore?: unknown; routes?: unknown };
    const student = await requireStarWarsStudent();
    const result = await saveStarWarsProgress({
      studentId: student.studentId,
      runId: body.runId,
      startScore: body.startScore,
      routes: body.routes
    });
    return NextResponse.json({ result }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const isInputError = error instanceof StarWarsInputError || error instanceof SyntaxError;
    const isAuthError = isStarWarsAuthenticationError(error);
    if (!isInputError && !isAuthError) console.error("[star-wars/progress] Unexpected error", error);
    const message = error instanceof SyntaxError
      ? "The Star Wars score request must contain valid JSON."
      : error instanceof Error
        ? error.message
        : "This Star Wars score could not be saved.";
    return NextResponse.json({
      error: isInputError || isAuthError
        ? message
        : "Your Star Wars score could not be saved right now. Please try again."
    }, {
      status: isInputError ? 400 : isAuthError ? 401 : 503,
      headers: { "Cache-Control": "no-store" }
    });
  }
}
