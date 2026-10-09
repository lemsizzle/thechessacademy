import { NextResponse } from "next/server";
import { requireActiveStudent, StudentAuthenticationError } from "@/lib/auth/requireActiveStudent";
import { parseDisplayedBadgeChoice } from "@/lib/badges/displayedBadge";
import { BadgeNotEarnedError, getOwnDisplayedBadge, setDisplayedBadge } from "@/lib/badges/displayedBadgeServer";

export const dynamic = "force-dynamic";
const privateHeaders = { "Cache-Control": "private, no-store" };

export async function GET() {
  try {
    const student = await requireActiveStudent();
    return NextResponse.json({ ok: true, displayedBadge: await getOwnDisplayedBadge(student.studentId) }, { headers: privateHeaders });
  } catch (error) { return failed(error); }
}

export async function PATCH(request: Request) {
  try {
    const student = await requireActiveStudent();
    let badgeId: string | null;
    try { badgeId = parseDisplayedBadgeChoice(await request.json()); }
    catch (error) { return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Invalid badge choice." }, { status: 400, headers: privateHeaders }); }
    return NextResponse.json({ ok: true, displayedBadge: await setDisplayedBadge(student.studentId, badgeId) }, { headers: privateHeaders });
  } catch (error) { return failed(error); }
}

function failed(error: unknown) {
  const expected = error instanceof StudentAuthenticationError || error instanceof BadgeNotEarnedError;
  return NextResponse.json({ ok: false, error: expected ? error.message : "Your badge could not be saved. Try again." },
    { status: error instanceof StudentAuthenticationError ? 401 : error instanceof BadgeNotEarnedError ? 403 : 503, headers: privateHeaders });
}
