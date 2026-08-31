import type { Square } from "chess.js";

export type HideAndSeekSquare = Square;

export type HideAndSeekMode = "classic" | "time_trial";

export type HideAndSeekPieceCode = "bK" | "bQ" | "bR" | "bB" | "bN";

export type HideAndSeekPiecePlacement = {
  piece: HideAndSeekPieceCode;
  square: HideAndSeekSquare;
};

export type HideAndSeekBoard = {
  generatorVersion: number;
  seed: string;
  candidateIndex: number;
  pieces: readonly HideAndSeekPiecePlacement[];
  safeSquares: readonly HideAndSeekSquare[];
};

export type HideAndSeekScoreInput = {
  safeSquares: readonly HideAndSeekSquare[];
  selectedSquares: readonly HideAndSeekSquare[];
  elapsedMs: number;
  mode?: HideAndSeekMode;
};

export type HideAndSeekScore = {
  score: number;
  elapsedMs: number;
  totalSafe: number;
  correctCount: number;
  wrongCount: number;
  foundPercent: number;
  safeSquares: readonly HideAndSeekSquare[];
  correctSquares: readonly HideAndSeekSquare[];
  wrongSquares: readonly HideAndSeekSquare[];
  missedSquares: readonly HideAndSeekSquare[];
};

type RandomSource = () => number;
type Coordinates = { file: number; rank: number };

export const HIDE_AND_SEEK_GENERATOR_VERSION = 1 as const;
export const HIDE_AND_SEEK_MIN_SAFE_SQUARES = 10;
export const HIDE_AND_SEEK_MAX_SAFE_SQUARES = 24;
export const HIDE_AND_SEEK_TARGET_SAFE_SQUARES = 17;
export const HIDE_AND_SEEK_MAX_GENERATION_CANDIDATES = 128;
export const HIDE_AND_SEEK_ACCURACY_POINTS = 600;
export const HIDE_AND_SEEK_SPEED_POINTS = 400;
export const HIDE_AND_SEEK_CLASSIC_SPEED_WINDOW_MS = 120_000;
export const HIDE_AND_SEEK_TIME_TRIAL_LIMIT_MS = 60_000;

export const HIDE_AND_SEEK_ARMY: readonly HideAndSeekPieceCode[] = Object.freeze([
  "bK",
  "bQ",
  "bR",
  "bR",
  "bB",
  "bB",
  "bN",
  "bN"
]);

export const HIDE_AND_SEEK_BOARD_SQUARES: readonly HideAndSeekSquare[] = Object.freeze(
  Array.from({ length: 8 }, (_, rankIndex) => (
    Array.from({ length: 8 }, (_, fileIndex) => (
      `${String.fromCharCode(97 + fileIndex)}${rankIndex + 1}` as HideAndSeekSquare
    ))
  )).flat()
);

const boardSquareOrder = new Map(
  HIDE_AND_SEEK_BOARD_SQUARES.map((square, index) => [square, index] as const)
);

const knightDirections: readonly (readonly [number, number])[] = [
  [-2, -1], [-2, 1], [-1, -2], [-1, 2],
  [1, -2], [1, 2], [2, -1], [2, 1]
];

const kingDirections: readonly (readonly [number, number])[] = [
  [-1, -1], [-1, 0], [-1, 1], [0, -1],
  [0, 1], [1, -1], [1, 0], [1, 1]
];

const rookDirections: readonly (readonly [number, number])[] = [
  [-1, 0], [0, -1], [0, 1], [1, 0]
];

const bishopDirections: readonly (readonly [number, number])[] = [
  [-1, -1], [-1, 1], [1, -1], [1, 1]
];

const pieceToFen: Record<HideAndSeekPieceCode, string> = {
  bB: "b",
  bK: "k",
  bN: "n",
  bQ: "q",
  bR: "r"
};

export function isHideAndSeekSquare(value: unknown): value is HideAndSeekSquare {
  return typeof value === "string" && /^[a-h][1-8]$/.test(value);
}

export function isHideAndSeekMode(value: unknown): value is HideAndSeekMode {
  return value === "classic" || value === "time_trial";
}

function assertValidPlacements(pieces: readonly HideAndSeekPiecePlacement[]) {
  const occupied = new Set<HideAndSeekSquare>();
  for (const placement of pieces) {
    if (!isHideAndSeekSquare(placement.square)) {
      throw new TypeError(`Invalid Hide and Seek square: ${String(placement.square)}`);
    }
    if (!Object.prototype.hasOwnProperty.call(pieceToFen, placement.piece)) {
      throw new TypeError(`Invalid Hide and Seek piece: ${String(placement.piece)}`);
    }
    if (occupied.has(placement.square)) {
      throw new Error(`Hide and Seek square ${placement.square} is occupied more than once.`);
    }
    occupied.add(placement.square);
  }
  return occupied;
}

function coordinates(square: HideAndSeekSquare): Coordinates {
  return {
    file: square.charCodeAt(0) - 97,
    rank: Number(square[1]) - 1
  };
}

function squareAt(file: number, rank: number): HideAndSeekSquare | null {
  if (file < 0 || file > 7 || rank < 0 || rank > 7) return null;
  return `${String.fromCharCode(97 + file)}${rank + 1}` as HideAndSeekSquare;
}

function sortedSquares(values: Iterable<HideAndSeekSquare>) {
  return [...values].sort((left, right) => (
    (boardSquareOrder.get(left) ?? 0) - (boardSquareOrder.get(right) ?? 0)
  ));
}

function addJumpAttacks(
  attacked: Set<HideAndSeekSquare>,
  from: Coordinates,
  directions: readonly (readonly [number, number])[]
) {
  for (const [fileDelta, rankDelta] of directions) {
    const square = squareAt(from.file + fileDelta, from.rank + rankDelta);
    if (square) attacked.add(square);
  }
}

function addSlidingAttacks(
  attacked: Set<HideAndSeekSquare>,
  from: Coordinates,
  directions: readonly (readonly [number, number])[],
  occupied: ReadonlySet<HideAndSeekSquare>
) {
  for (const [fileStep, rankStep] of directions) {
    let file = from.file + fileStep;
    let rank = from.rank + rankStep;
    let square = squareAt(file, rank);
    while (square) {
      attacked.add(square);
      if (occupied.has(square)) break;
      file += fileStep;
      rank += rankStep;
      square = squareAt(file, rank);
    }
  }
}

/**
 * Returns every square seen by at least one black piece. Sliding pieces see
 * the first occupied square on a ray, but cannot see through it.
 */
export function calculateHideAndSeekAttackedSquares(
  pieces: readonly HideAndSeekPiecePlacement[]
): HideAndSeekSquare[] {
  const occupied = assertValidPlacements(pieces);
  const attacked = new Set<HideAndSeekSquare>();

  for (const placement of pieces) {
    const from = coordinates(placement.square);
    switch (placement.piece) {
      case "bN":
        addJumpAttacks(attacked, from, knightDirections);
        break;
      case "bK":
        addJumpAttacks(attacked, from, kingDirections);
        break;
      case "bR":
        addSlidingAttacks(attacked, from, rookDirections, occupied);
        break;
      case "bB":
        addSlidingAttacks(attacked, from, bishopDirections, occupied);
        break;
      case "bQ":
        addSlidingAttacks(attacked, from, [...rookDirections, ...bishopDirections], occupied);
        break;
    }
  }

  return sortedSquares(attacked);
}

/** Empty board squares that no black piece can see. */
export function calculateHideAndSeekSafeSquares(
  pieces: readonly HideAndSeekPiecePlacement[]
): HideAndSeekSquare[] {
  const occupied = assertValidPlacements(pieces);
  const attacked = new Set(calculateHideAndSeekAttackedSquares(pieces));
  return HIDE_AND_SEEK_BOARD_SQUARES.filter((square) => (
    !occupied.has(square) && !attacked.has(square)
  ));
}

/** A renderer-ready FEN. Chess legality is intentionally irrelevant here. */
export function hideAndSeekBoardFen(pieces: readonly HideAndSeekPiecePlacement[]) {
  assertValidPlacements(pieces);
  const pieceBySquare = new Map(pieces.map((placement) => [placement.square, placement.piece] as const));
  const ranks: string[] = [];

  for (let rank = 8; rank >= 1; rank -= 1) {
    let empty = 0;
    let encoded = "";
    for (let file = 0; file < 8; file += 1) {
      const square = `${String.fromCharCode(97 + file)}${rank}` as HideAndSeekSquare;
      const piece = pieceBySquare.get(square);
      if (!piece) {
        empty += 1;
        continue;
      }
      if (empty) encoded += String(empty);
      empty = 0;
      encoded += pieceToFen[piece];
    }
    if (empty) encoded += String(empty);
    ranks.push(encoded);
  }

  return `${ranks.join("/")} b - - 0 1`;
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

/** A small seeded PRNG whose integer operations are stable across JS runtimes. */
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

function generatedCandidateV1(seed: string, candidateIndex: number): HideAndSeekBoard {
  const random = randomSource(
    `hide-and-seek-v1:${seed}:${candidateIndex}`
  );
  const squares = shuffled(HIDE_AND_SEEK_BOARD_SQUARES, random);
  const pieces = HIDE_AND_SEEK_ARMY.map((piece, index) => ({
    piece,
    square: squares[index]
  } satisfies HideAndSeekPiecePlacement));

  return {
    generatorVersion: 1,
    seed,
    candidateIndex,
    pieces,
    safeSquares: calculateHideAndSeekSafeSquares(pieces)
  };
}

/**
 * Generates a repeatable position from a seed without consulting a puzzle
 * bank. Positions outside the target safe-square range are retried; if every
 * candidate misses the range, the candidate closest to 17 is returned.
 */
function generateHideAndSeekBoardV1(seed: string): HideAndSeekBoard {
  if (typeof seed !== "string") throw new TypeError("Hide and Seek seed must be a string.");

  let closest: HideAndSeekBoard | null = null;
  let closestDistance = Number.POSITIVE_INFINITY;
  for (let candidateIndex = 0; candidateIndex < HIDE_AND_SEEK_MAX_GENERATION_CANDIDATES; candidateIndex += 1) {
    const candidate = generatedCandidateV1(seed, candidateIndex);
    const safeCount = candidate.safeSquares.length;
    if (safeCount >= HIDE_AND_SEEK_MIN_SAFE_SQUARES && safeCount <= HIDE_AND_SEEK_MAX_SAFE_SQUARES) {
      return candidate;
    }

    const distance = Math.abs(safeCount - HIDE_AND_SEEK_TARGET_SAFE_SQUARES);
    if (distance < closestDistance) {
      closest = candidate;
      closestDistance = distance;
    }
  }

  // There is always at least one candidate because the configured limit is
  // positive. Keep the explicit guard so future configuration errors fail loud.
  if (!closest) throw new Error("Hide and Seek could not generate a board.");
  return closest;
}

/**
 * Regenerates a board with the exact algorithm named in an issued token. Keep
 * old cases when adding a new generator so in-flight and idempotent retries
 * continue to work across deployments.
 */
export function generateHideAndSeekBoardForVersion(
  generatorVersion: number,
  seed: string
): HideAndSeekBoard {
  switch (generatorVersion) {
    case 1:
      return generateHideAndSeekBoardV1(seed);
    default:
      throw new RangeError("This Hide and Seek board generator is no longer supported.");
  }
}

export function generateHideAndSeekBoard(seed: string): HideAndSeekBoard {
  return generateHideAndSeekBoardForVersion(HIDE_AND_SEEK_GENERATOR_VERSION, seed);
}

function validatedSquareSet(
  values: readonly HideAndSeekSquare[],
  label: string
) {
  const squares = new Set<HideAndSeekSquare>();
  for (const square of values) {
    if (!isHideAndSeekSquare(square)) {
      throw new TypeError(`Invalid ${label} square: ${String(square)}`);
    }
    squares.add(square);
  }
  return squares;
}

/** Calculates the server-authoritative result for a completed search. */
export function calculateHideAndSeekScore(input: HideAndSeekScoreInput): HideAndSeekScore {
  const safe = validatedSquareSet(input.safeSquares, "safe");
  const selected = validatedSquareSet(input.selectedSquares, "selected");
  const safeSquares = sortedSquares(safe);
  const correctSquares = sortedSquares([...selected].filter((square) => safe.has(square)));
  const wrongSquares = sortedSquares([...selected].filter((square) => !safe.has(square)));
  const missedSquares = sortedSquares([...safe].filter((square) => !selected.has(square)));
  const totalSafe = safe.size;
  const correctCount = correctSquares.length;
  const wrongCount = wrongSquares.length;
  const elapsedMs = Number.isFinite(input.elapsedMs)
    ? Math.max(0, input.elapsedMs)
    : 0;
  const denominator = totalSafe + wrongCount;
  const accuracyFactor = denominator > 0 ? correctCount / denominator : 0;
  const speedWindowMs = input.mode === "time_trial"
    ? HIDE_AND_SEEK_TIME_TRIAL_LIMIT_MS
    : HIDE_AND_SEEK_CLASSIC_SPEED_WINDOW_MS;
  const speedFactor = Math.max(0, 1 - elapsedMs / speedWindowMs);
  const score = Math.min(1_000, Math.max(0, Math.round(
    accuracyFactor * (
      HIDE_AND_SEEK_ACCURACY_POINTS
      + HIDE_AND_SEEK_SPEED_POINTS * speedFactor
    )
  )));
  const foundPercent = totalSafe > 0
    ? Math.round((correctCount / totalSafe) * 1_000) / 10
    : 0;

  return {
    score,
    elapsedMs,
    totalSafe,
    correctCount,
    wrongCount,
    foundPercent,
    safeSquares,
    correctSquares,
    wrongSquares,
    missedSquares
  };
}
