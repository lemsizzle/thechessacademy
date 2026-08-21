import { exportAnalysisTreeToPgn } from "@/chess/analysis/pgn";
import { getChapter } from "@/chess/persistence/studyServer";
import { requireChessActor } from "@/lib/auth/requireChessActor";

export const dynamic = "force-dynamic";

function filename(title: string) {
  const safe = title.normalize("NFKD").replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
  return `${safe || "chess-academy-study"}.pgn`;
}

export async function GET(_request: Request, { params }: { params: Promise<{ studyId: string; chapterId: string }> }) {
  try {
    const actor = await requireChessActor();
    const { studyId, chapterId } = await params;
    const chapter = await getChapter(actor, studyId, chapterId);
    const rawHeaders = chapter.metadata.pgnHeaders;
    const headers = rawHeaders && typeof rawHeaders === "object" && !Array.isArray(rawHeaders)
      ? rawHeaders as Record<string, unknown>
      : {};
    const pgn = exportAnalysisTreeToPgn(chapter.tree, {
      Event: chapter.title,
      ...headers,
      Result: typeof chapter.metadata.result === "string" ? chapter.metadata.result : headers.Result
    });
    return new Response(pgn, {
      headers: {
        "Cache-Control": "private, no-store",
        "Content-Disposition": `attachment; filename="${filename(chapter.title)}"`,
        "Content-Type": "application/x-chess-pgn; charset=utf-8"
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "PGN export failed.";
    return Response.json({ error: message }, { status: message.includes("permission") ? 403 : message.includes("not found") ? 404 : 500 });
  }
}
