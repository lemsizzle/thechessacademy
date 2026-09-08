import { NextResponse } from "next/server";
import { maintainInternalArenas } from "@/chess/persistence/arenaServer";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request) {
  if (!process.env.CRON_SECRET || request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  try {
    return NextResponse.json({ ok: true, ...await maintainInternalArenas() });
  } catch (error) {
    console.error("Arena maintenance failed", error);
    return NextResponse.json({ ok: false, error: "Arena maintenance requires retry." }, { status: 500 });
  }
}
