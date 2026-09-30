import { hasLiveInternalArena } from "@/chess/persistence/arenaServer";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function liveStatusResponse(live: boolean) {
  return NextResponse.json(
    { live },
    // This response is one public boolean, never student-specific data.
    { headers: { "Cache-Control": "public, max-age=15", "Vercel-CDN-Cache-Control": "public, s-maxage=30, stale-while-revalidate=30" } }
  );
}

export async function GET() {
  const now = Date.now();

  try {
    if (await hasLiveInternalArena(new Date(now))) return liveStatusResponse(true);
  } catch {
    // Do not advertise an Arena when its status cannot be verified.
  }

  return liveStatusResponse(false);
}
