import { Chess, type PieceSymbol, type Square } from "chess.js";

export type StarWarsPieceSymbol = Exclude<PieceSymbol, "p">;

export type StarWarsMove = {
  from: Square;
  to: Square;
};

export type StarWarsPuzzle = {
  id: string;
  title: string;
  briefing: string;
  tier: 1 | 2 | 3 | 4;
  fen: string;
  stars: readonly Square[];
  pieces: ReadonlyArray<{ type: StarWarsPieceSymbol; square: Square }>;
  movableSquares: readonly Square[];
  hiddenPieceTypes: readonly string[];
};

export type StarWarsState = {
  fen: string;
  remainingStars: readonly Square[];
  movableSquares: readonly Square[];
};

export type StarWarsMoveResult =
  | { status: "illegal"; state: StarWarsState }
  | { status: "failed"; reason: "missed-star"; state: StarWarsState }
  | { status: "advanced"; move: StarWarsMove; state: StarWarsState }
  | { status: "solved"; move: StarWarsMove; state: StarWarsState };

type PuzzleBlueprint = Omit<StarWarsPuzzle, "fen" | "movableSquares" | "hiddenPieceTypes"> & {
  whiteKingSquare?: Square;
  blackKingSquare?: Square;
};

const pieceFenSymbol: Record<StarWarsPieceSymbol, string> = {
  b: "B",
  k: "K",
  n: "N",
  q: "Q",
  r: "R"
};

function encodeFenBoard(board: ReadonlyMap<Square, string>) {
  return Array.from({ length: 8 }, (_, rankIndex) => {
    const rank = 8 - rankIndex;
    let empty = 0;
    let encoded = "";
    for (let fileIndex = 0; fileIndex < 8; fileIndex += 1) {
      const square = `${String.fromCharCode(97 + fileIndex)}${rank}` as Square;
      const piece = board.get(square);
      if (!piece) {
        empty += 1;
        continue;
      }
      if (empty) encoded += String(empty);
      empty = 0;
      encoded += piece;
    }
    return `${encoded}${empty || ""}`;
  }).join("/");
}

function buildPuzzle(blueprint: PuzzleBlueprint): StarWarsPuzzle {
  const board = new Map<Square, string>();
  const occupied = new Set<Square>();
  const place = (square: Square, piece: string) => {
    if (occupied.has(square)) throw new Error(`Star Wars square ${square} is occupied twice.`);
    occupied.add(square);
    board.set(square, piece);
  };

  for (const piece of blueprint.pieces) place(piece.square, pieceFenSymbol[piece.type]);
  const hasVisibleKing = blueprint.pieces.some((piece) => piece.type === "k");
  if (!hasVisibleKing) place(blueprint.whiteKingSquare ?? "a1", "K");
  place(blueprint.blackKingSquare ?? "h8", "k");

  for (const star of blueprint.stars) {
    if (occupied.has(star)) throw new Error(`Star Wars star ${star} overlaps a chess piece.`);
  }

  const fen = `${encodeFenBoard(board)} w - - 0 1`;
  new Chess(fen);
  return {
    ...blueprint,
    fen,
    movableSquares: blueprint.pieces.map((piece) => piece.square),
    hiddenPieceTypes: ["bK", ...(hasVisibleKing ? [] : ["wK"])]
  };
}

const puzzleBlueprints: readonly PuzzleBlueprint[] = [
  {
    id: "knight-launch",
    title: "Knight Launch",
    briefing: "Plot the knight's whole flight before takeoff.",
    tier: 1,
    pieces: [{ type: "n", square: "b1" }],
    stars: ["d2", "f3", "h4"]
  },
  {
    id: "rook-radar",
    title: "Rook Radar",
    briefing: "Choose the right row or file at every stop.",
    tier: 1,
    pieces: [{ type: "r", square: "b2" }],
    stars: ["b5", "e5", "e2"]
  },
  {
    id: "bishop-beacon",
    title: "Bishop Beacon",
    briefing: "Stay on the bishop's color and connect every beacon.",
    tier: 2,
    pieces: [{ type: "b", square: "b1" }],
    stars: ["d3", "b5", "d7", "f5"]
  },
  {
    id: "royal-orbit",
    title: "Royal Orbit",
    briefing: "Guide the king around the cluster without wasting a step.",
    tier: 2,
    pieces: [{ type: "k", square: "c3" }],
    stars: ["d4", "e4", "e3", "d2"]
  },
  {
    id: "twin-knights",
    title: "Twin Knights",
    briefing: "Both knights are on the mission. Decide which one moves next.",
    tier: 2,
    pieces: [{ type: "n", square: "b1" }, { type: "n", square: "g1" }],
    stars: ["d2", "e2", "f3", "g3"]
  },
  {
    id: "rook-relay",
    title: "Rook Relay",
    briefing: "The rook can see several stars. Only a planned order gets them all.",
    tier: 3,
    pieces: [{ type: "r", square: "b2" }],
    stars: ["b5", "e5", "e2", "g2", "g6"],
    blackKingSquare: "a8"
  },
  {
    id: "queen-comet",
    title: "Queen Comet",
    briefing: "Mix straight and diagonal moves into one clean route.",
    tier: 3,
    pieces: [{ type: "q", square: "d2" }],
    stars: ["d5", "g5", "g2", "b2", "b7"],
    blackKingSquare: "h8"
  },
  {
    id: "split-squad",
    title: "Split Squad",
    briefing: "Coordinate the rook and bishop. Every move must collect a star.",
    tier: 3,
    pieces: [{ type: "r", square: "a2" }, { type: "b", square: "c1" }],
    stars: ["a5", "e3", "d5", "g5", "d7"]
  },
  {
    id: "royal-escort",
    title: "Royal Escort",
    briefing: "Use the queen and knight as a team. Think beyond the first capture.",
    tier: 4,
    pieces: [{ type: "q", square: "d1" }, { type: "n", square: "b1" }],
    stars: ["d4", "c3", "d7", "e5", "g4", "f6"],
    blackKingSquare: "h8"
  },
  {
    id: "bishop-wing",
    title: "Bishop Wing",
    briefing: "Two bishops, two colors, one exact flight plan.",
    tier: 4,
    pieces: [{ type: "b", square: "c1" }, { type: "b", square: "f1" }],
    stars: ["e3", "g5", "e7", "h3", "f5", "h7"],
    blackKingSquare: "a8"
  }
];

export const STAR_WARS_PUZZLES: readonly StarWarsPuzzle[] = puzzleBlueprints.map(buildPuzzle);

const finishRouteCache = new Map<string, boolean>();
const solutionMovesCache = new Map<string, readonly StarWarsMove[]>();
const MAX_ROUTE_CACHE_ENTRIES = 10_000;

function rememberCacheValue<T>(cache: Map<string, T>, key: string, value: T) {
  if (cache.size >= MAX_ROUTE_CACHE_ENTRIES) cache.clear();
  cache.set(key, value);
  return value;
}

export function initialStarWarsState(puzzle: StarWarsPuzzle): StarWarsState {
  return {
    fen: puzzle.fen,
    remainingStars: [...puzzle.stars],
    movableSquares: [...puzzle.movableSquares]
  };
}

function keepWhiteToMove(fen: string) {
  const fields = fen.split(" ");
  fields[1] = "w";
  fields[2] = "-";
  fields[3] = "-";
  return fields.join(" ");
}

function stateKey(state: StarWarsState) {
  return `${state.fen.split(" ").slice(0, 4).join(" ")}|${[...state.movableSquares].sort().join(",")}|${[...state.remainingStars].sort().join(",")}`;
}

function playMove(state: StarWarsState, move: StarWarsMove): StarWarsState | null {
  if (!state.movableSquares.includes(move.from)) return null;
  const chess = new Chess(state.fen);
  const played = chess.moves({ square: move.from, verbose: true }).find((candidate) => candidate.to === move.to);
  if (!played) return null;
  chess.move({ from: played.from, to: played.to, ...(played.promotion ? { promotion: played.promotion } : {}) });
  return {
    fen: keepWhiteToMove(chess.fen()),
    remainingStars: state.remainingStars.filter((square) => square !== move.to),
    movableSquares: state.movableSquares.map((square) => square === move.from ? move.to : square)
  };
}

function starLandingMoves(state: StarWarsState) {
  const chess = new Chess(state.fen);
  return state.movableSquares.flatMap((square) => chess.moves({ square, verbose: true })
    .filter((move) => state.remainingStars.includes(move.to))
    .map((move) => ({ from: move.from, to: move.to } satisfies StarWarsMove)));
}

function canFinishRoute(state: StarWarsState): boolean {
  if (!state.remainingStars.length) return true;
  const key = stateKey(state);
  const cached = finishRouteCache.get(key);
  if (cached !== undefined) return cached;
  rememberCacheValue(finishRouteCache, key, false);
  for (const move of starLandingMoves(state)) {
    const next = playMove(state, move);
    if (next && canFinishRoute(next)) {
      rememberCacheValue(finishRouteCache, key, true);
      return true;
    }
  }
  return false;
}

/** Moves that still allow one star to be collected on every remaining move. */
export function starWarsSolutionMoves(state: StarWarsState): StarWarsMove[] {
  const key = stateKey(state);
  const cached = solutionMovesCache.get(key);
  if (cached) return [...cached];
  const solutionMoves = starLandingMoves(state).filter((move) => {
    const next = playMove(state, move);
    return Boolean(next && canFinishRoute(next));
  });
  rememberCacheValue(solutionMovesCache, key, solutionMoves);
  return [...solutionMoves];
}

export function findStarWarsSolution(state: StarWarsState): StarWarsMove[] | null {
  if (!state.remainingStars.length) return [];
  for (const move of starWarsSolutionMoves(state)) {
    const next = playMove(state, move);
    if (!next) continue;
    const rest = findStarWarsSolution(next);
    if (rest) return [move, ...rest];
  }
  return null;
}

export function attemptStarWarsMove(state: StarWarsState, move: StarWarsMove): StarWarsMoveResult {
  const next = playMove(state, move);
  if (!next) return { status: "illegal", state };
  if (!state.remainingStars.includes(move.to)) return { status: "failed", reason: "missed-star", state };

  return next.remainingStars.length
    ? { status: "advanced", move, state: next }
    : { status: "solved", move, state: next };
}

export function starWarsTierForScore(score: number): StarWarsPuzzle["tier"] {
  if (score < 2) return 1;
  if (score < 5) return 2;
  if (score < 9) return 3;
  return 4;
}

export function starWarsPuzzleForScore(score: number, runVariant = 0) {
  const tier = starWarsTierForScore(score);
  const candidates = STAR_WARS_PUZZLES.filter((puzzle) => puzzle.tier === tier);
  return candidates[(Math.max(0, score) + Math.max(0, runVariant)) % candidates.length];
}
