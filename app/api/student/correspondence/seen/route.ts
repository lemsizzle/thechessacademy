import { NextResponse } from "next/server";
import { markCorrespondenceChallengesSeen, CorrespondenceServerError } from "@/chess/persistence/correspondenceServer";
import { requireActiveStudent, StudentAuthenticationError } from "@/lib/auth/requireActiveStudent";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const student = await requireActiveStudent();
    const body = await request.json().catch(() => null);
    return NextResponse.json({ ok: true, ...(await markCorrespondenceChallengesSeen(student.studentId, body)) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Correspondence challenges could not be marked as seen.";
    const status = error instanceof StudentAuthenticationError ? 401 : error instanceof CorrespondenceServerError ? error.status : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
