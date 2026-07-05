import { getBadgesResult } from "@/lib/data/badges";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const result = await getBadgesResult();
  return NextResponse.json(result);
}
