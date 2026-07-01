import { readStudentSession } from "@/lib/auth/session";
import { createGameSubmission } from "@/lib/submissions/createGameSubmission";
import { createScoreSubmission } from "@/lib/submissions/createScoreSubmission";
import { insertSupabaseGameSubmission, insertSupabaseScoreSubmission, listSupabaseSubmissions } from "@/lib/submissions/supabaseSubmissions";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = readStudentSession(await cookies());
  if (!session) return NextResponse.json({ error: "Student log in required." }, { status: 401 });

  const result = await listSupabaseSubmissions(session.studentId);
  if (result.error) return NextResponse.json({ ...result, mode: "local-only" });
  return NextResponse.json(result);
}

export async function POST(request: Request) {
  const session = readStudentSession(await cookies());
  if (!session) return NextResponse.json({ error: "Student log in required." }, { status: 401 });

  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const type = body.type === "score" ? "score" : "game";

  try {
    if (type === "score") {
      const created = createScoreSubmission({
        studentId: session.studentId,
        challengeName: String(body.challengeName ?? ""),
        tacticTheme: String(body.tacticTheme ?? "Fork") as Parameters<typeof createScoreSubmission>[0]["tacticTheme"],
        score: Number(body.score ?? 0),
        notes: String(body.notes ?? "")
      });
      if (!created.ok) return NextResponse.json({ error: created.error }, { status: 400 });
      const result = await insertSupabaseScoreSubmission(created.submission);
      return NextResponse.json({ ok: true, type, ...result });
    }

    const created = createGameSubmission({
      studentId: session.studentId,
      gameUrl: String(body.gameUrl ?? ""),
      playedAs: (body.playedAs === "white" || body.playedAs === "black") ? body.playedAs : "unknown",
      gameType: String(body.gameType ?? ""),
      opponentName: String(body.opponentName ?? ""),
      notes: String(body.notes ?? "")
    });
    if (!created.ok) return NextResponse.json({ error: created.error }, { status: 400 });
    const result = await insertSupabaseGameSubmission(created.submission);
    return NextResponse.json({ ok: true, type, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not save submission.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
