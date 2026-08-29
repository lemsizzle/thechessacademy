import { NextResponse } from "next/server";
import { createCorrespondenceChallenge, CorrespondenceServerError } from "@/chess/persistence/correspondenceServer";
import { requireActiveStudent, StudentAuthenticationError } from "@/lib/auth/requireActiveStudent";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const student = await requireActiveStudent();
    const body = await request.json().catch(() => null);
    const challenge = await createCorrespondenceChallenge(student.studentId, body);
    return NextResponse.json({ ok: true, challenge }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "The correspondence challenge could not be sent.";
    const status = error instanceof StudentAuthenticationError ? 401 : error instanceof CorrespondenceServerError ? error.status : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
