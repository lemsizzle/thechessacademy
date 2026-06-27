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

export async function fetchStudentGamesForWindow(username: string, start: Date, end: Date, perfType: LichessGamePerfType = "rapid") {
  const params = new URLSearchParams({
    since: String(start.getTime()),
    until: String(end.getTime()),
    rated: "true",
    perfType,
    max: "100",
    moves: "false",
    pgnInJson: "false"
  });
  const response = await fetch(`https://lichess.org/api/games/user/${encodeURIComponent(username)}?${params}`, {
    headers: { Accept: "application/x-ndjson" },
    cache: "no-store"
  });
  if (!response.ok) throw new Error(`Lichess game activity failed with ${response.status}.`);
  const safeUsername = normalizeUsername(username);
  return parseNdjson<RawGame>(await response.text()).map((game): LichessQuestGame => {
    const white = normalizeUsername(game.players?.white?.user?.name ?? game.players?.white?.user?.id);
    const black = normalizeUsername(game.players?.black?.user?.name ?? game.players?.black?.user?.id);
    const studentColor = white === safeUsername ? "white" : black === safeUsername ? "black" : undefined;
    return {
      id: game.id ?? crypto.randomUUID(),
      playedAt: new Date(game.lastMoveAt ?? game.createdAt ?? Date.now()).toISOString(),
      perfType: game.perf ?? game.speed ?? perfType,
      rated: game.rated === true,
      finished: !["aborted", "created", "started"].includes(game.status ?? ""),
      turns: game.turns ?? 0,
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
    won: index < 6
  }));
}
