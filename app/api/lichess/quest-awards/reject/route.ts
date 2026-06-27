import { rejectQuestAward } from "@/lib/quests/rejectQuestAward";
import type { PendingQuestAward } from "@/lib/types";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({})) as { award?: PendingQuestAward; rejectionReason?: string };
  if (!body.award || body.award.status !== "pending") return NextResponse.json({ error: "A pending quest award is required." }, { status: 400 });
  return NextResponse.json({ award: rejectQuestAward(body.award, body.rejectionReason) });
}
