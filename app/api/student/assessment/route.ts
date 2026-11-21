import { NextRequest, NextResponse } from "next/server";
import { requireActiveStudent, StudentAuthenticationError } from "@/lib/auth/requireActiveStudent";
import { assessmentPayload, saveAssessment, startAssessment } from "@/lib/assessment/server";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store" };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function failure(error: unknown) {
  const auth = error instanceof StudentAuthenticationError;
  const invalid = error instanceof SyntaxError || (error instanceof Error && error.message.startsWith("Invalid"));
  return NextResponse.json({ error: auth ? "Please log in to take your test." : invalid ? "Invalid assessment request." : "Your test couldn't be saved or loaded. Check your connection and retry." }, { status: auth ? 401 : invalid ? 400 : 503, headers });
}
export async function GET(request: NextRequest) {
  try {
    const student = await requireActiveStudent();
    const id = request.nextUrl.searchParams.get("attempt") || undefined;
    if (id && !uuid.test(id)) throw new Error("Invalid assessment ID");
    return NextResponse.json(await assessmentPayload(student.studentId, undefined, id), { headers });
  } catch (error) { return failure(error); }
}
export async function POST(request: NextRequest) {
  try {
    const student = await requireActiveStudent();
    const text = await request.text();
    if (text.length > 6000) throw new Error("Invalid request size");
    const body = JSON.parse(text);
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("Invalid request");
    if (body.action === "start") return NextResponse.json(await assessmentPayload(student.studentId, await startAssessment(student.studentId)), { headers });
    if (!["save", "submit"].includes(body.action) || typeof body.attemptId !== "string" || !uuid.test(body.attemptId)) throw new Error("Invalid action");
    const attempt = await saveAssessment(student.studentId, body.attemptId, body.answers, body.action === "submit");
    // Ordinary autosaves don't fetch history or resend diagrams/the full question set.
    return NextResponse.json(body.action === "submit" || attempt.completed_at ? await assessmentPayload(student.studentId, attempt) : { attempt, serverNow: new Date().toISOString() }, { headers });
  } catch (error) { return failure(error); }
}
