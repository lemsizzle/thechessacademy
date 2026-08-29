import { NextResponse } from "next/server";
import {
  isStarWarsAuthenticationError,
  requireStarWarsStudent,
  startStarWarsRun
} from "@/lib/puzzle-training/starWarsServer";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const student = await requireStarWarsStudent();
    const run = await startStarWarsRun(student.studentId);
    return NextResponse.json({ run }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const isAuthError = isStarWarsAuthenticationError(error);
    if (!isAuthError) console.error("[star-wars/start] Unexpected error", error);
    return NextResponse.json({
      error: isAuthError && error instanceof Error
        ? error.message
        : "Star Wars is temporarily unavailable. Please try again."
    }, {
      status: isAuthError ? 401 : 503,
      headers: { "Cache-Control": "no-store" }
    });
  }
}
