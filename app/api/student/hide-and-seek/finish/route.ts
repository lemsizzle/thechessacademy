import { NextRequest, NextResponse } from "next/server";
import {
  HideAndSeekInputError,
  finishHideAndSeekRound,
  isHideAndSeekAuthenticationError,
  requireHideAndSeekStudent
} from "@/lib/puzzle-training/hideAndSeekServer";
import { HideAndSeekTokenError } from "@/lib/puzzle-training/hideAndSeekToken";

export const dynamic = "force-dynamic";

async function readBody(request: NextRequest) {
  const value = await request.json() as unknown;
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new HideAndSeekInputError("The scoring request must be a JSON object.");
  }
  return value as { token?: unknown; selectedSquares?: unknown };
}

export async function POST(request: NextRequest) {
  const receivedAt = Date.now();
  try {
    const body = await readBody(request);
    const student = await requireHideAndSeekStudent();
    const result = await finishHideAndSeekRound({
      studentId: student.studentId,
      token: typeof body.token === "string" ? body.token : "",
      selectedSquares: body.selectedSquares,
      nowMs: receivedAt
    });
    return NextResponse.json({ result }, {
      headers: { "Cache-Control": "no-store" }
    });
  } catch (error) {
    const isInputError = error instanceof HideAndSeekInputError || error instanceof SyntaxError;
    const isAuthError = error instanceof HideAndSeekTokenError || isHideAndSeekAuthenticationError(error);
    if (!isInputError && !isAuthError) {
      console.error("[hide-and-seek/finish] Unexpected error", error);
    }
    const message = error instanceof SyntaxError
      ? "The scoring request must contain valid JSON."
      : error instanceof Error
        ? error.message
        : "This search could not be scored.";
    return NextResponse.json({
      error: isInputError || isAuthError
        ? message
        : "Your search could not be scored right now. Please try again."
    }, {
      status: isInputError ? 400 : isAuthError ? 401 : 503,
      headers: { "Cache-Control": "no-store" }
    });
  }
}
