import { NextRequest, NextResponse } from "next/server";
import {
  HideAndSeekInputError,
  isHideAndSeekAuthenticationError,
  requireHideAndSeekStudent,
  startHideAndSeekRound
} from "@/lib/puzzle-training/hideAndSeekServer";
import { HideAndSeekTokenError } from "@/lib/puzzle-training/hideAndSeekToken";

export const dynamic = "force-dynamic";

async function readBody(request: NextRequest) {
  const text = await request.text();
  if (!text.trim()) return {};
  const value = JSON.parse(text) as unknown;
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new HideAndSeekInputError("The start request must be a JSON object.");
  }
  return value;
}

export async function POST(request: NextRequest) {
  const serverReceivedAt = new Date().toISOString();
  try {
    await readBody(request);
    const student = await requireHideAndSeekStudent();
    const response = startHideAndSeekRound(student.studentId);
    return NextResponse.json({ ...response, serverReceivedAt }, {
      headers: { "Cache-Control": "no-store" }
    });
  } catch (error) {
    const isInputError = error instanceof HideAndSeekInputError || error instanceof SyntaxError;
    const isAuthError = error instanceof HideAndSeekTokenError || isHideAndSeekAuthenticationError(error);
    if (!isInputError && !isAuthError) {
      console.error("[hide-and-seek/start] Unexpected error", error);
    }
    const message = error instanceof SyntaxError
      ? "The start request must contain valid JSON."
      : error instanceof Error
        ? error.message
        : "Hide and Seek is unavailable.";
    return NextResponse.json({
      error: isInputError || isAuthError
        ? message
        : "Hide and Seek is temporarily unavailable. Please try again."
    }, {
      status: isInputError ? 400 : isAuthError ? 401 : 503,
      headers: { "Cache-Control": "no-store" }
    });
  }
}
