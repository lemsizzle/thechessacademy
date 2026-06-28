import { parseNdjson } from "@/lib/lichess/parseNdjson";
import type { LichessQuestGame } from "@/lib/types";

type RawGame = {
  id?: string;
  createdAt?: number;
  lastMoveAt?: number;
  rated?: boolean;
  perf?: string;
  speed?: string;
  status?: string;
  turns?: number;
  moves?: string;
  pgn?: string;
  winner?: "white" | "black";
  players?: {
    white?: { user?: { id?: string; name?: string } };
    black?: { user?: { id?: string; name?: string } };
  };
};

export type LichessGamePerfType = "bullet" | "blitz" | "rapid" | "classical" | "correspondence";

function normalizeUsername(value?: string) {
  return value?.toLowerCase() ?? "";
}

function countMovesFromPgn(pgn?: string) {
  if (!pgn?.trim()) return 0;
  const body = pgn
    .replace(/\[[^\]]+\]\s*/g, " ")
    .replace(/\{[^}]*\}/g, " ")
    .replace(/\([^)]*\)/g, " ")
    .replace(/\d+\.(\.\.)?/g, " ")
    .replace(/\b(1-0|0-1|1\/2-1\/2|\*)\b/g, " ")
    .trim();
  if (!body) return 0;
  return Math.ceil(body.split(/\s+/).filter(Boolean).length / 2);
}

function countFullMoves(game: RawGame) {
  if (game.moves?.trim()) return Math.ceil(game.moves.trim().split(/\s+/).length / 2);
  const pgnMoves = countMovesFromPgn(game.pgn);
  if (pgnMoves > 0) return pgnMoves;
  if (typeof game.turns === "number") return Math.ceil(game.turns / 2);
  return 0;
}

export async function fetchStudentGamesForWindow(username: string, start: Date, end: Date, perfType: LichessGamePerfType = "rapid", accessToken?: string | null) {
  const requestEnd = new Date(Math.min(end.getTime(), Date.now() + 2 * 60_000));
  const params = new URLSearchParams({
    since: String(start.getTime()),
    until: String(requestEnd.getTime()),
    rated: "true",
    perfType,
    max: "300",
    moves: "true",
    pgnInJson: "true"
  });
  const response = await fetch(`https://lichess.org/api/games/user/${encodeURIComponent(username)}?${params}`, {
    headers: {
      Accept: "application/x-ndjson",
      ...(accessToken && !accessToken.startsWith("mock-token-") ? { Authorization: `Bearer ${accessToken}` } : {})
    },
    cache: "no-store"
  });
  if (!response.ok) throw new Error(`Lichess game activity failed with ${response.status}.`);
  const safeUsername = normalizeUsername(username);
  return parseNdjson<RawGame>(await response.text()).map((game): LichessQuestGame => {
    const white = normalizeUsername(game.players?.white?.user?.name ?? game.players?.white?.user?.id);
    const black = normalizeUsername(game.players?.black?.user?.name ?? game.players?.black?.user?.id);
    const studentColor = white === safeUsername ? "white" : black === safeUsername ? "black" : undefined;
    const moveCount = countFullMoves(game);
    return {
      id: game.id ?? crypto.randomUUID(),
      playedAt: new Date(game.lastMoveAt ?? game.createdAt ?? Date.now()).toISOString(),
      perfType: game.perf ?? game.speed ?? perfType,
      rated: game.rated === true,
      finished: !["aborted", "created", "started"].includes(game.status ?? ""),
      turns: game.turns ?? 0,
      moveCount,
      won: Boolean(studentColor && game.winner === studentColor)
    };
  });
}

export function createMockStudentGamesForWindow(start: Date, perfType: LichessGamePerfType = "rapid"): LichessQuestGame[] {
  return Array.from({ length: 12 }, (_, index) => ({
    id: `mock-${perfType}-game-${index}`,
    playedAt: new Date(start.getTime() + (index + 1) * 45 * 60_000).toISOString(),
    perfType,
    rated: true,
    finished: true,
    turns: 20 + index,
    moveCount: Math.ceil((20 + index) / 2),
    won: index < 6
  }));
}
