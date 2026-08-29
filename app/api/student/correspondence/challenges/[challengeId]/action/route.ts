import { NextResponse } from "next/server";
import { performCorrespondenceChallengeAction, CorrespondenceServerError } from "@/chess/persistence/correspondenceServer";
import { requireActiveStudent, StudentAuthenticationError } from "@/lib/auth/requireActiveStudent";

export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ challengeId: string }> }) {
  try {
    const student = await requireActiveStudent();
    const [{ challengeId }, body] = await Promise.all([params, request.json().catch(() => null)]);
    const result = await performCorrespondenceChallengeAction(student.studentId, challengeId, body);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "The correspondence challenge could not be updated.";
    const status = error instanceof StudentAuthenticationError ? 401 : error instanceof CorrespondenceServerError ? error.status : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
