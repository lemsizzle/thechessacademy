import { getQuestsResult } from "@/lib/data/quests";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const result = await getQuestsResult();
  return NextResponse.json(result);
}
