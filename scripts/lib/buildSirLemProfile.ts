import { Chess } from "chess.js";
import { repertoirePositionKey } from "../../chess/bots/repertoire";
import type { BotRepertoire } from "../../chess/types";

export const SIR_LEM_GENERATOR = {
  version: 2,
  maxPly: 80,
  minPositionGames: 2,
  maxPositions: 6_000,
  recencyHalfLifeDays: 180
} as const;

type LichessPlayer = { user?: { id?: string; name?: string } };
export type LichessProfileGame = {
  id?: string;
  variant?: string;
  rated?: boolean;
  status?: string;
  createdAt?: number;
  initialFen?: string;
  moves?: string;
  players?: { white?: LichessPlayer; black?: LichessPlayer };
};

export function buildSirLemProfile(games: LichessProfileGame[]) {
  const initialFen = new Chess().fen();
  const isSource = (player?: LichessPlayer) => (player?.user?.id ?? player?.user?.name)?.toLowerCase() === "so_pawny";
  const eligible = games.filter((game) => game.rated && game.variant === "standard"
    && game.status !== "started" && game.status !== "created"
    && (!game.initialFen || game.initialFen === "startpos" || game.initialFen === initialFen)
    && (isSource(game.players?.white) || isSource(game.players?.black))
    && Number.isFinite(game.createdAt) && (game.createdAt ?? 0) > 0);
  const latestGameAt = Math.max(0, ...eligible.map((game) => game.createdAt!));
  const positions = new Map<string, { games: number; moves: Map<string, { count: number; weight: number }> }>();
  const seenGames = new Set<string>();
  let validGames = 0;
  let observedMoves = 0;

  for (const game of eligible) {
    if (!game.id || seenGames.has(game.id)) continue;
    seenGames.add(game.id);
    const side = isSource(game.players?.white) ? "w" : "b";
    // Validate the sampled portion before adding anything. Repeated positions
    // count once per game so a repetition cannot distort move frequencies.
    const observations = new Map<string, string>();
    const chess = new Chess();
    try {
      const moves = game.moves?.trim().split(/\s+/).filter(Boolean).slice(0, SIR_LEM_GENERATOR.maxPly) ?? [];
      if (!moves.length) continue;
      for (const san of moves) {
        const key = repertoirePositionKey(chess);
        const sourceTurn = chess.turn() === side;
        const move = chess.move(san);
        if (sourceTurn && !observations.has(key)) observations.set(key, `${move.from}${move.to}${move.promotion ?? ""}`);
      }
    } catch {
      continue;
    }
    if (!observations.size) continue;
    validGames++;
    const ageDays = (latestGameAt - game.createdAt!) / 86_400_000;
    const weight = Math.max(1, Math.round(1_000 * 2 ** (-ageDays / SIR_LEM_GENERATOR.recencyHalfLifeDays)));
    for (const [key, uci] of observations) {
      observedMoves++;
      const position = positions.get(key) ?? { games: 0, moves: new Map() };
      position.games++;
      const choice = position.moves.get(uci) ?? { count: 0, weight: 0 };
      choice.count++;
      choice.weight += weight;
      position.moves.set(uci, choice);
      positions.set(key, position);
    }
  }

  const retained = [...positions].filter(([, position]) => position.games >= SIR_LEM_GENERATOR.minPositionGames)
    .sort(([a, left], [b, right]) => right.games - left.games || a.localeCompare(b))
    .slice(0, SIR_LEM_GENERATOR.maxPositions)
    .sort(([a], [b]) => a.localeCompare(b));
  const repertoire: BotRepertoire = Object.fromEntries(retained.map(([key, position]) => [key,
    [...position.moves].map(([uci, value]) => ({ uci, ...value }))
      .sort((a, b) => b.weight - a.weight || a.uci.localeCompare(b.uci))
  ]));
  const rememberedMoves = retained.reduce((sum, [, position]) => sum + position.games, 0);
  return {
    repertoire,
    source: {
      username: "So_Pawny",
      games: validGames,
      positions: retained.length,
      observedMoves,
      rememberedMoves,
      updatedThrough: latestGameAt ? new Date(latestGameAt).toISOString() : null,
      ...SIR_LEM_GENERATOR
    }
  };
}
