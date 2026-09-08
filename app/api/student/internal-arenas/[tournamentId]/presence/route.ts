import { NextResponse } from "next/server";
import { arenaQueuePresence, InternalArenaServerError } from "@/chess/persistence/arenaServer";
import { requireActiveStudent, StudentAuthenticationError } from "@/lib/auth/requireActiveStudent";

export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ tournamentId: string }> }) {
  try {
    const [student, { tournamentId }, body] = await Promise.all([requireActiveStudent(), params, request.json()]);
    if (!body || typeof body !== "object" || Array.isArray(body)
      || (body.action !== undefined && !["heartbeat", "pause", "join"].includes(body.action))
      || (body.gameId !== undefined && typeof body.gameId !== "string")) {
      return NextResponse.json({ ok: false, error: "Invalid queue request." }, { status: 400 });
    }
    const queue = await arenaQueuePresence(tournamentId, student.studentId, body.action ?? "heartbeat", body.gameId);
    return NextResponse.json({ ok: true, queue }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const status = error instanceof StudentAuthenticationError ? 401 : error instanceof InternalArenaServerError ? error.status : 500;
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Queue unavailable." }, { status });
  }
}
