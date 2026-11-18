import { NextRequest, NextResponse } from "next/server";
import {
  StarWarsInputError,
  isStarWarsAuthenticationError,
  parseStarWarsStartOptions,
  requireStarWarsStudent,
  startStarWarsRun
} from "@/lib/puzzle-training/starWarsServer";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const serverReceivedAt = new Date().toISOString();
  try {
    const text = await request.text();
    const options = parseStarWarsStartOptions(text.trim() ? JSON.parse(text) as unknown : undefined);
    const student = await requireStarWarsStudent();
    const run = await startStarWarsRun(student.studentId, options);
    return NextResponse.json({ run, serverReceivedAt }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const isInputError = error instanceof StarWarsInputError || error instanceof SyntaxError;
    const isAuthError = isStarWarsAuthenticationError(error);
    if (!isInputError && !isAuthError) console.error("[star-wars/start] Unexpected error", error);
    const message = error instanceof SyntaxError
      ? "The Path Finder start request must contain valid JSON."
      : error instanceof Error
        ? error.message
        : "Path Finder is temporarily unavailable. Please try again.";
    return NextResponse.json({
      error: isInputError || isAuthError
        ? message
        : "Path Finder is temporarily unavailable. Please try again."
    }, {
      status: isInputError ? 400 : isAuthError ? 401 : 503,
      headers: { "Cache-Control": "no-store" }
    });
  }
}
