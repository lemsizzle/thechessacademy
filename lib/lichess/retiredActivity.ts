import { NextResponse } from "next/server";

export function retiredLichessActivity(_request?: Request) {
  return NextResponse.json({ error: "Lichess is used only for login. Play games and puzzles in Chess Quest to earn progress.", code: "LICHESS_ACTIVITY_RETIRED" }, { status: 410, headers: { "Cache-Control": "no-store" } });
}
