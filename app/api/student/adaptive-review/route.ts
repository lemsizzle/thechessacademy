import { NextResponse } from "next/server";
import { getStudentAdaptiveReview, recordAdaptiveReviewAttempt } from "@/chess/training/adaptiveReviewServer";
import { requireActiveStudent, StudentAuthenticationError } from "@/lib/auth/requireActiveStudent";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const student = await requireActiveStudent();
    return NextResponse.json(await getStudentAdaptiveReview(student.studentId));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Review queue could not be loaded.";
    return NextResponse.json({ error: message }, { status: error instanceof StudentAuthenticationError ? 401 : 500 });
  }
}

export async function POST(request: Request) {
  try {
    const student = await requireActiveStudent();
    const body = await request.json() as { itemId?: string; moveUci?: string; reveal?: boolean; responseMs?: number };
    if (!body.itemId) return NextResponse.json({ error: "Review item id is required." }, { status: 400 });
    return NextResponse.json(await recordAdaptiveReviewAttempt({
      studentId: student.studentId,
      itemId: body.itemId,
      moveUci: body.moveUci,
      reveal: body.reveal === true,
      responseMs: body.responseMs
    }));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Review attempt could not be saved.";
    const status = error instanceof StudentAuthenticationError ? 401 : /invalid|required|not legal|not found/i.test(message) ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
