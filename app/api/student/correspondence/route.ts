import { NextResponse } from "next/server";
import { getCorrespondenceInbox, CorrespondenceServerError } from "@/chess/persistence/correspondenceServer";
import { requireActiveStudent, StudentAuthenticationError } from "@/lib/auth/requireActiveStudent";

export const dynamic = "force-dynamic";

function errorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : "Correspondence challenges could not be loaded.";
  const status = error instanceof StudentAuthenticationError ? 401 : error instanceof CorrespondenceServerError ? error.status : 500;
  return NextResponse.json({ ok: false, error: message }, { status });
}

export async function GET() {
  try {
    const student = await requireActiveStudent();
    return NextResponse.json({ ok: true, inbox: await getCorrespondenceInbox(student.studentId) });
  } catch (error) {
    return errorResponse(error);
  }
}
