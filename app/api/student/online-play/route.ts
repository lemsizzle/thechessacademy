import { NextResponse } from "next/server";
import { requireActiveStudent, StudentAuthenticationError } from "@/lib/auth/requireActiveStudent";
import { getOnlinePlay, OnlinePlayError, performOnlineAction } from "@/lib/onlinePlay/server";

export const dynamic = "force-dynamic";
function failure(error: unknown) {
  const status = error instanceof StudentAuthenticationError ? 401 : error instanceof OnlinePlayError ? error.status : 500;
  return NextResponse.json({ error: status === 500 ? "Online play is unavailable." : (error as Error).message }, { status, headers: { "Cache-Control": "no-store" } });
}
export async function GET() {
  try {
    const student = await requireActiveStudent();
    return NextResponse.json({ state: await getOnlinePlay(student.studentId) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return failure(error); }
}
export async function POST(request: Request) {
  try {
    // Block cross-origin requests; existing same-site cookies remain required.
    const origin = request.headers.get("origin");
    if (origin && origin !== new URL(request.url).origin) throw new OnlinePlayError("Request origin is not allowed.", 403);
    const student = await requireActiveStudent();
    const body = await request.json().catch(() => null);
    const result = await performOnlineAction(student.studentId, body);
    // Opt in so older clients do not pay for a list they will immediately fetch again.
    if (body?.action === "heartbeat" && body.includeState === true) {
      return NextResponse.json({ result, state: await getOnlinePlay(student.studentId) }, { headers: { "Cache-Control": "no-store" } });
    }
    return NextResponse.json({ result }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return failure(error); }
}
