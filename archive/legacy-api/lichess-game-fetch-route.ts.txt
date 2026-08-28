import { fetchLichessGameById } from "@/lib/lichess/fetchLichessGameById";
import { parseLichessGameUrl } from "@/lib/lichess/parseLichessGameUrl";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const { url } = await request.json().catch(() => ({ url: "" })) as { url?: string };
  const parsed = parseLichessGameUrl(url ?? "");
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const result = await fetchLichessGameById(parsed.gameId);
  return NextResponse.json({ ...result, parsed });
}
