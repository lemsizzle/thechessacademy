import { approveQuestAward } from "@/lib/quests/approveQuestAward";
import type { PendingQuestAward } from "@/lib/types";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({})) as { award?: PendingQuestAward };
  if (!body.award || body.award.status !== "pending") return NextResponse.json({ error: "A pending quest award is required." }, { status: 400 });
  return NextResponse.json(approveQuestAward(body.award));
}
