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
  blackKingSquare: Square;
};

type TierProfile = {
  stars: number;
  pieces: number;
  piecePool: readonly StarWarsPieceSymbol[];
};

type RouteCandidate = {
  pieceIndex: number;
  move: StarWarsMove;
};

type GeneratedLayout = {
  pieces: Array<{ type: StarWarsPieceSymbol; square: Square }>;
  whiteKingSquare?: Square;
  blackKingSquare: Square;
  fen: string;
};

type RandomSource = () => number;

const GENERATOR_VERSION = 2;
const MAX_GENERATION_ATTEMPTS = 128;
const MAX_GENERATED_PUZZLE_CACHE_ENTRIES = 2_048;
const MAX_ROUTE_CACHE_ENTRIES = 10_000;

const BOARD_SQUARES = Array.from({ length: 8 }, (_, rankIndex) => (
  Array.from({ length: 8 }, (_, fileIndex) => `${String.fromCharCode(97 + fileIndex)}${rankIndex + 1}` as Square)
)).flat();

const TIER_PROFILES: Record<StarWarsPuzzle["tier"], TierProfile> = {
  1: { stars: 3, pieces: 1, piecePool: ["n", "r", "b"] },
  2: { stars: 4, pieces: 2, piecePool: ["n", "r", "b"] },
  3: { stars: 5, pieces: 2, piecePool: ["n", "r", "b", "q"] },
  4: { stars: 6, pieces: 3, piecePool: ["n", "r", "b", "q"] }
};

const pieceFenSymbol: Record<StarWarsPieceSymbol, string> = {
  b: "B",
  k: "K",
  n: "N",
  q: "Q",
  r: "R"
};

const pieceTitle: Record<StarWarsPieceSymbol, string> = {
  b: "Bishop Beacon",
  k: "Royal Orbit",
  n: "Knight Flight",
  q: "Queen Comet",
  r: "Rook Relay"
};

const tierBriefings: Record<StarWarsPuzzle["tier"], string> = {
  1: "Plot one piece's complete route before launch.",
  2: "Coordinate both pieces and collect one star on every move.",
  3: "Several stars are in range. Plan the full sequence before moving.",
  4: "Command the whole squad. One wasted move ends this mission."
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

function boardFen(
  pieces: readonly { type: StarWarsPieceSymbol; square: Square }[],
  whiteKingSquare: Square | undefined,
  blackKingSquare: Square
) {
  const board = new Map<Square, string>();
  for (const piece of pieces) board.set(piece.square, pieceFenSymbol[piece.type]);
  if (whiteKingSquare) board.set(whiteKingSquare, "K");
  board.set(blackKingSquare, "k");
  return `${encodeFenBoard(board)} w - - 0 1`;
}

function buildPuzzle(blueprint: PuzzleBlueprint): StarWarsPuzzle {
  const { whiteKingSquare, blackKingSquare, ...publicBlueprint } = blueprint;
  const occupied = new Set<Square>();
  for (const piece of blueprint.pieces) {
    if (occupied.has(piece.square)) throw new Error(`Star Wars square ${piece.square} is occupied twice.`);
    occupied.add(piece.square);
  }

  const hasVisibleKing = blueprint.pieces.some((piece) => piece.type === "k");
  if (!hasVisibleKing) {
    const square = whiteKingSquare ?? "a1";
    if (occupied.has(square)) throw new Error(`Star Wars square ${square} is occupied twice.`);
    occupied.add(square);
  }
  if (occupied.has(blackKingSquare)) throw new Error(`Star Wars square ${blackKingSquare} is occupied twice.`);
  occupied.add(blackKingSquare);

  const stars = new Set<Square>();
  for (const star of blueprint.stars) {
    if (occupied.has(star)) throw new Error(`Star Wars star ${star} overlaps a chess piece.`);
    if (stars.has(star)) throw new Error(`Star Wars star ${star} appears twice.`);
    stars.add(star);
  }

  const fen = boardFen(blueprint.pieces, hasVisibleKing ? undefined : whiteKingSquare ?? "a1", blackKingSquare);
  return {
    ...publicBlueprint,
    fen,
    movableSquares: blueprint.pieces.map((piece) => piece.square),
    hiddenPieceTypes: ["bK", ...(hasVisibleKing ? [] : ["wK"])]
  };
}

function normalizedMissionNumber(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.min(Number.MAX_SAFE_INTEGER, Math.max(0, Math.floor(value)));
}

function hashString(value: string) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  hash ^= hash >>> 16;
  hash = Math.imul(hash, 0x85ebca6b);
  hash ^= hash >>> 13;
  hash = Math.imul(hash, 0xc2b2ae35);
  return (hash ^ (hash >>> 16)) >>> 0;
}

/** A small seeded PRNG whose integer operations are stable in every JS runtime. */
function randomSource(seed: string): RandomSource {
  let a = hashString(`${seed}:a`);
  let b = hashString(`${seed}:b`);
  let c = hashString(`${seed}:c`);
  let d = hashString(`${seed}:d`);
  return () => {
    a >>>= 0;
    b >>>= 0;
    c >>>= 0;
    d >>>= 0;
    const result = (a + b + d) >>> 0;
    d = (d + 1) >>> 0;
    a = (b ^ (b >>> 9)) >>> 0;
    b = (c + (c << 3)) >>> 0;
    c = ((c << 21) | (c >>> 11)) >>> 0;
    c = (c + result) >>> 0;
    return result / 0x1_0000_0000;
  };
}

function shuffled<T>(values: readonly T[], random: RandomSource) {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1));
    [result[index], result[target]] = [result[target], result[index]];
  }
  return result;
}

function choosePieceTypes(profile: TierProfile, random: RandomSource) {
  const result: StarWarsPieceSymbol[] = [];
  while (result.length < profile.pieces) {
    const type = profile.piecePool[Math.floor(random() * profile.piecePool.length)];
    if (type === "k" && result.includes("k")) continue;
    result.push(type);
  }
  return result;
}

function squareCoordinates(square: Square) {
  return { file: square.charCodeAt(0) - 97, rank: Number(square[1]) - 1 };
}

function learnerAttacksSquare(
  piece: { type: StarWarsPieceSymbol; square: Square },
  targetSquare: Square,
  occupied: ReadonlySet<Square>
) {
  const from = squareCoordinates(piece.square);
  const target = squareCoordinates(targetSquare);
  const fileDelta = target.file - from.file;
  const rankDelta = target.rank - from.rank;
  const absoluteFile = Math.abs(fileDelta);
  const absoluteRank = Math.abs(rankDelta);
  if (piece.type === "n") return (absoluteFile === 1 && absoluteRank === 2) || (absoluteFile === 2 && absoluteRank === 1);
  if (piece.type === "k") return Math.max(absoluteFile, absoluteRank) === 1;

  const diagonal = absoluteFile === absoluteRank && absoluteFile > 0;
  const straight = (fileDelta === 0) !== (rankDelta === 0);
  if (!((piece.type === "b" && diagonal) || (piece.type === "r" && straight) || (piece.type === "q" && (diagonal || straight)))) return false;

  const fileStep = Math.sign(fileDelta);
  const rankStep = Math.sign(rankDelta);
  let file = from.file + fileStep;
  let rank = from.rank + rankStep;
  while (file !== target.file || rank !== target.rank) {
    const square = `${String.fromCharCode(97 + file)}${rank + 1}` as Square;
    if (occupied.has(square)) return false;
    file += fileStep;
    rank += rankStep;
  }
  return true;
}

function createLayout(types: readonly StarWarsPieceSymbol[], random: RandomSource): GeneratedLayout | null {
  const squares = shuffled(BOARD_SQUARES, random);
  const pieces = types.map((type, index) => ({ type, square: squares[index] }));
  const hasVisibleKing = types.includes("k");
  const occupied = new Set(pieces.map((piece) => piece.square));
  const supportSquares = shuffled(BOARD_SQUARES.filter((square) => !occupied.has(square)), random);
  const blackKingSquare = supportSquares.find((square) => !pieces.some((piece) => learnerAttacksSquare(piece, square, occupied)));
  if (!blackKingSquare) return null;
  const black = squareCoordinates(blackKingSquare);
  const whiteKingSquare = hasVisibleKing ? undefined : supportSquares.find((square) => {
    if (square === blackKingSquare) return false;
    const white = squareCoordinates(square);
    return Math.max(Math.abs(white.file - black.file), Math.abs(white.rank - black.rank)) > 1;
  });
  if (!hasVisibleKing && !whiteKingSquare) return null;

  const fen = boardFen(pieces, whiteKingSquare, blackKingSquare);
  return { pieces, whiteKingSquare, blackKingSquare, fen };
}

function keepWhiteToMove(fen: string) {
  const fields = fen.split(" ");
  fields[1] = "w";
  fields[2] = "-";
  fields[3] = "-";
  return fields.join(" ");
}

function routeCandidates(
  chess: Chess,
  movableSquares: readonly Square[],
  originalSquares: ReadonlySet<Square>,
  stars: ReadonlySet<Square>,
  requiredPieceIndex: number | null
) {
  const candidates: RouteCandidate[] = [];
  movableSquares.forEach((square, pieceIndex) => {
    if (requiredPieceIndex !== null && requiredPieceIndex !== pieceIndex) return;
    for (const move of chess.moves({ square, verbose: true })) {
      if (originalSquares.has(move.to) || stars.has(move.to)) continue;
      candidates.push({ pieceIndex, move: { from: move.from, to: move.to } });
    }
  });
  return candidates.sort((left, right) => {
    if (left.pieceIndex !== right.pieceIndex) return left.pieceIndex - right.pieceIndex;
    const leftKey = `${left.move.from}${left.move.to}`;
    const rightKey = `${right.move.from}${right.move.to}`;
    return leftKey < rightKey ? -1 : leftKey > rightKey ? 1 : 0;
  });
}

function selectRouteCandidate(chess: Chess, candidates: readonly RouteCandidate[], random: RandomSource) {
  for (const candidate of shuffled(candidates, random)) {
    chess.move(candidate.move);
    // The lesson immediately returns the turn to White. Avoid creating a
    // position in which the hidden black king is still in check.
    if (chess.inCheck()) {
      chess.undo();
      continue;
    }
    return { ...candidate, nextFen: keepWhiteToMove(chess.fen()) };
  }
  return null;
}

function generatedTitle(types: readonly StarWarsPieceSymbol[]) {
  const unique = [...new Set(types)];
  return unique.length === 1 ? pieceTitle[unique[0]] : "Fleet Formation";
}

function generatedPuzzle(score: number, runVariant: number, attempt: number): StarWarsPuzzle | null {
  const tier = starWarsTierForScore(score);
  const profile = TIER_PROFILES[tier];
  const seed = `star-wars-v${GENERATOR_VERSION}:${runVariant}:${score}:${attempt}`;
  const random = randomSource(seed);
  const types = choosePieceTypes(profile, random);
  const layout = createLayout(types, random);
  if (!layout) return null;

  const originalSquares = new Set(layout.pieces.map((piece) => piece.square));
  const stars = new Set<Square>();
  const route: StarWarsMove[] = [];
  const movableSquares = layout.pieces.map((piece) => piece.square);
  const requiredPieceOrder = shuffled(movableSquares.map((_, index) => index), random);
  let fen = layout.fen;

  for (let step = 0; step < profile.stars; step += 1) {
    const requiredPieceIndex = step < requiredPieceOrder.length ? requiredPieceOrder[step] : null;
    const position = new Chess(fen);
    const candidates = routeCandidates(
      position,
      movableSquares,
      originalSquares,
      stars,
      requiredPieceIndex
    );
    if (!candidates.length) return null;
    const selected = selectRouteCandidate(position, candidates, random);
    if (!selected) return null;
    route.push(selected.move);
    stars.add(selected.move.to);
    movableSquares[selected.pieceIndex] = selected.move.to;
    fen = selected.nextFen;
  }

  const starSquares = shuffled([...stars], random);
  const positionFingerprint = hashString(`${layout.fen}|${[...starSquares].sort().join(",")}`).toString(36);
  const puzzle = buildPuzzle({
    id: `star-wars-v${GENERATOR_VERSION}-${runVariant.toString(36)}-${score.toString(36)}-${positionFingerprint}`,
    title: generatedTitle(types),
    briefing: tierBriefings[tier],
    tier,
    pieces: layout.pieces,
    stars: starSquares,
    whiteKingSquare: layout.whiteKingSquare,
    blackKingSquare: layout.blackKingSquare
  });
  rememberCacheValue(knownSolutionRouteCache, stateKey(initialStarWarsState(puzzle)), route);
  return puzzle;
}

function fallbackPuzzle(score: number, runVariant: number): StarWarsPuzzle {
  const tier = starWarsTierForScore(score);
  const profile = TIER_PROFILES[tier];
  const fallbackPieces: Array<{ type: StarWarsPieceSymbol; square: Square }> = [
    { type: "n", square: "b1" },
    { type: "r", square: "a4" },
    { type: "b", square: "c1" }
  ];
  const fallbackStars: Square[] = ["d2", "f3", "h4", "f5", "d6", "b7"];
  const pieces = fallbackPieces.slice(0, profile.pieces);
  const stars = fallbackStars.slice(0, profile.stars);
  const puzzle = buildPuzzle({
    id: `star-wars-v${GENERATOR_VERSION}-${runVariant.toString(36)}-${score.toString(36)}-fallback`,
    title: generatedTitle(pieces.map((piece) => piece.type)),
    briefing: tierBriefings[tier],
    tier,
    pieces,
    stars,
    whiteKingSquare: "a1",
    blackKingSquare: "h8"
  });
  const fallbackRoute: StarWarsMove[] = [
    { from: "b1", to: "d2" },
    { from: "d2", to: "f3" },
    { from: "f3", to: "h4" },
    { from: "h4", to: "f5" },
    { from: "f5", to: "d6" },
    { from: "d6", to: "b7" }
  ];
  const route = fallbackRoute.slice(0, profile.stars);
  rememberCacheValue(knownSolutionRouteCache, stateKey(initialStarWarsState(puzzle)), route);
  return puzzle;
}

const generatedPuzzleCache = new Map<string, StarWarsPuzzle>();
const finishRouteCache = new Map<string, boolean>();
const solutionMovesCache = new Map<string, readonly StarWarsMove[]>();
const knownSolutionRouteCache = new Map<string, readonly StarWarsMove[]>();
const firstRouteCache = new Map<string, readonly StarWarsMove[] | null>();

function rememberCacheValue<T>(cache: Map<string, T>, key: string, value: T, maximum = MAX_ROUTE_CACHE_ENTRIES) {
  if (cache.size >= maximum) cache.clear();
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
  const key = stateKey(state);
  const knownRoute = knownSolutionRouteCache.get(key);
  if (knownRoute) return [...knownRoute];
  if (firstRouteCache.has(key)) {
    const cached = firstRouteCache.get(key);
    return cached ? [...cached] : null;
  }
  for (const move of starLandingMoves(state)) {
    const next = playMove(state, move);
    if (!next) continue;
    const rest = findStarWarsSolution(next);
    if (rest) {
      const route = [move, ...rest];
      rememberCacheValue(firstRouteCache, key, route);
      return route;
    }
  }
  rememberCacheValue(firstRouteCache, key, null);
  return null;
}

export function attemptStarWarsMove(state: StarWarsState, move: StarWarsMove): StarWarsMoveResult {
  const next = playMove(state, move);
  if (!next) return { status: "illegal", state };
  if (!state.remainingStars.includes(move.to)) return { status: "failed", reason: "missed-star", state };

  const knownRoute = knownSolutionRouteCache.get(stateKey(state));
  if (knownRoute?.[0]?.from === move.from && knownRoute[0].to === move.to) {
    rememberCacheValue(knownSolutionRouteCache, stateKey(next), knownRoute.slice(1));
  }

  // Any legal star landing is allowed, even when that choice later traps the
  // route. This is an intentional planning consequence, not an immediate loss.
  return next.remainingStars.length
    ? { status: "advanced", move, state: next }
    : { status: "solved", move, state: next };
}

export function starWarsTierForScore(score: number): StarWarsPuzzle["tier"] {
  const normalizedScore = normalizedMissionNumber(score);
  if (normalizedScore < 2) return 1;
  if (normalizedScore < 5) return 2;
  if (normalizedScore < 9) return 3;
  return 4;
}

/** Builds a deterministic mission without consulting the runtime cache. */
export function generateStarWarsPuzzle(score: number, runVariant = 0) {
  const normalizedScore = normalizedMissionNumber(score);
  const normalizedVariant = normalizedMissionNumber(runVariant);
  for (let attempt = 0; attempt < MAX_GENERATION_ATTEMPTS; attempt += 1) {
    const puzzle = generatedPuzzle(normalizedScore, normalizedVariant, attempt);
    if (puzzle) return puzzle;
  }
  // This route is deliberately simple and prevalidated. It keeps a live run
  // moving even if a future generator change rejects every seeded candidate.
  return fallbackPuzzle(normalizedScore, normalizedVariant);
}

/** Returns a fresh deterministic mission for this score/run seed. */
export function starWarsPuzzleForScore(score: number, runVariant = 0) {
  const normalizedScore = normalizedMissionNumber(score);
  const normalizedVariant = normalizedMissionNumber(runVariant);
  const key = `${normalizedVariant}:${normalizedScore}`;
  const cached = generatedPuzzleCache.get(key);
  if (cached) return cached;
  return rememberCacheValue(
    generatedPuzzleCache,
    key,
    generateStarWarsPuzzle(normalizedScore, normalizedVariant),
    MAX_GENERATED_PUZZLE_CACHE_ENTRIES
  );
}

/**
 * Compatibility preview for callers that used the original immutable bank.
 * Mission selection no longer cycles through this array.
 */
export const STAR_WARS_PUZZLES: readonly StarWarsPuzzle[] = Object.freeze(
  Array.from({ length: 12 }, (_, score) => starWarsPuzzleForScore(score, 0))
);
