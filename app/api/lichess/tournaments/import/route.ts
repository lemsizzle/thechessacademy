import { importArenaTournament } from "@/lib/tournaments/importArenaTournament";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  let body: { input?: string };
  try {
    body = await request.json() as { input?: string };
  } catch {
    return NextResponse.json({ ok: false, error: "A valid JSON request is required." }, { status: 400 });
  }
  const result = await importArenaTournament(body.input ?? "");
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
