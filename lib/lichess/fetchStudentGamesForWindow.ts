import { parseNdjson } from "@/lib/lichess/parseNdjson";
import { getRetryAfterSeconds, isLichessRateLimitError, LichessRateLimitError, sanitizeLichessErrorDetail } from "@/lib/lichess/rateLimit";
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
  winnerColor?: "white" | "black";
  color?: "white" | "black";
  players?: {
    white?: { user?: { id?: string; name?: string } };
    black?: { user?: { id?: string; name?: string } };
  };
};

export type LichessGamePerfType = "bullet" | "blitz" | "rapid" | "classical" | "correspondence";

const GAME_ACTIVITY_CACHE_TTL_MS = 60_000;
const gameActivityCache = new Map<string, { expiresAt: number; games: LichessQuestGame[] }>();

function cacheKey(username: string, start: Date, end: Date, perfType: LichessGamePerfType) {
  const normalizedEndMinute = Math.floor(end.getTime() / 60_000);
  return `${normalizeUsername(username)}:${perfType}:${start.getTime()}:${normalizedEndMinute}`;
}

function normalizeUsername(value?: string) {
  return value?.trim().toLowerCase() ?? "";
}

function getPgnHeader(pgn: string | undefined, name: string) {
  if (!pgn) return undefined;
  const match = pgn.match(new RegExp(`\\[${name}\\s+"([^"]+)"\\]`, "i"));
  return match?.[1];
}

function getWinnerFromPgn(pgn?: string) {
  const result = getPgnHeader(pgn, "Result") ?? pgn?.match(/\b(1-0|0-1|1\/2-1\/2)\b/)?.[1];
  if (result === "1-0") return "white" as const;
  if (result === "0-1") return "black" as const;
  return undefined;
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

async function fetchRawGames(username: string, params: URLSearchParams, accessToken?: string | null) {
  const response = await fetch(`https://lichess.org/api/games/user/${encodeURIComponent(username)}?${params}`, {
    headers: {
      Accept: "application/x-ndjson",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {})
    },
    cache: "no-store"
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    if (response.status === 429) {
      const retryAfterSeconds = getRetryAfterSeconds(response.headers);
      throw new LichessRateLimitError("Lichess rate limit reached for game activity. Try again after the cooldown.", retryAfterSeconds);
    }
    const cleanDetail = sanitizeLichessErrorDetail(detail);
    throw new Error(`Lichess game activity failed with ${response.status}${cleanDetail ? `: ${cleanDetail}` : ""}.`);
  }
  return parseNdjson<RawGame>(await response.text());
}

function mapGame(game: RawGame, username: string, fallbackPerfType: LichessGamePerfType): LichessQuestGame {
  const safeUsername = normalizeUsername(username);
  const whiteCandidates = [
    game.players?.white?.user?.name,
    game.players?.white?.user?.id,
    getPgnHeader(game.pgn, "White")
  ].map(normalizeUsername).filter(Boolean);
  const blackCandidates = [
    game.players?.black?.user?.name,
    game.players?.black?.user?.id,
    getPgnHeader(game.pgn, "Black")
  ].map(normalizeUsername).filter(Boolean);
  const studentColor = whiteCandidates.includes(safeUsername) ? "white" : blackCandidates.includes(safeUsername) ? "black" : game.color;
  const winner = game.winner ?? game.winnerColor ?? getWinnerFromPgn(game.pgn);
  const moveCount = countFullMoves(game);
  return {
    id: game.id ?? crypto.randomUUID(),
    playedAt: new Date(game.lastMoveAt ?? game.createdAt ?? Date.now()).toISOString(),
    perfType: game.perf ?? game.speed ?? fallbackPerfType,
    rated: game.rated === true,
    finished: !["aborted", "created", "started"].includes(game.status ?? ""),
    turns: game.turns ?? 0,
    moveCount,
    won: Boolean(studentColor && winner === studentColor)
  };
}

export async function fetchStudentGamesForWindow(username: string, start: Date, end: Date, perfType: LichessGamePerfType = "rapid", accessToken?: string | null) {
  const requestEnd = new Date(Math.min(end.getTime(), Date.now() + 2 * 60_000));
  const key = cacheKey(username, start, requestEnd, perfType);
  const cached = gameActivityCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.games;
  const narrowParams = new URLSearchParams({
    since: String(start.getTime()),
    until: String(requestEnd.getTime()),
    rated: "true",
    perfType,
    max: "300",
    moves: "true",
    pgnInJson: "true"
  });
  const broadParams = new URLSearchParams({
    since: String(start.getTime()),
    until: String(requestEnd.getTime()),
    max: "300",
    moves: "true",
    pgnInJson: "true"
  });

  try {
    const narrowGames = await fetchRawGames(username, narrowParams, accessToken);
    const games = narrowGames.map((game) => mapGame(game, username, perfType));
    gameActivityCache.set(key, { expiresAt: Date.now() + GAME_ACTIVITY_CACHE_TTL_MS, games });
    return games;
  } catch (error) {
    if (isLichessRateLimitError(error)) throw error;
    // Retry below with fewer Lichess filters, then filter locally.
  }

  const broadGames = await fetchRawGames(username, broadParams, accessToken);
  const games = broadGames
    .map((game) => mapGame(game, username, perfType))
    .filter((game) => game.perfType === perfType && game.rated);
  gameActivityCache.set(key, { expiresAt: Date.now() + GAME_ACTIVITY_CACHE_TTL_MS, games });
  return games;
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
