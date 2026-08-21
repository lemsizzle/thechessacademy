import type { BotDifficulty, ChessColor, PlayerColorChoice, TimeControl } from "@/chess/types";

export const BOT_DIFFICULTIES: BotDifficulty[] = [
  {
    id: "pawny",
    name: "Pawny",
    title: "Complete Beginner",
    estimatedRating: 375,
    multiPv: 10,
    thinkTimeMs: 220,
    tacticalAwareness: 0.18,
    complexitySensitivity: 1.4,
    qualityDiscipline: 0.12,
    selectionTemperature: 72,
    maxPlausibleCpLoss: 900,
    errorBands: [
      { minCpLoss: 0, maxCpLoss: 50, weight: 22, complexityMultiplier: 0 },
      { minCpLoss: 50, maxCpLoss: 150, weight: 30, complexityMultiplier: 0.35 },
      { minCpLoss: 150, maxCpLoss: 300, weight: 27, complexityMultiplier: 1 },
      { minCpLoss: 300, maxCpLoss: 600, weight: 16, complexityMultiplier: 1.8 },
      { minCpLoss: 600, maxCpLoss: 900, weight: 5, complexityMultiplier: 2.8 }
    ],
    personality: {
      checks: 18, captures: 35, threats: 8, development: -8, center: 4,
      castling: -5, safety: 5, defense: 3, simplification: 0, knights: 2,
      pawnMoves: 32, edgePawns: 24, earlyQueen: 22, repeatedPiece: 24, unforcedKing: -75
    },
    description: "New to chess: loves pawn moves and obvious captures, but misses many threats."
  },
  {
    id: "knight",
    name: "Zippy Knight",
    title: "Excited Attacker",
    estimatedRating: 575,
    multiPv: 9,
    thinkTimeMs: 260,
    tacticalAwareness: 0.34,
    complexitySensitivity: 1.15,
    qualityDiscipline: 0.2,
    selectionTemperature: 58,
    maxPlausibleCpLoss: 700,
    errorBands: [
      { minCpLoss: 0, maxCpLoss: 50, weight: 28, complexityMultiplier: 0 },
      { minCpLoss: 50, maxCpLoss: 150, weight: 38, complexityMultiplier: 0.3 },
      { minCpLoss: 150, maxCpLoss: 300, weight: 24, complexityMultiplier: 1 },
      { minCpLoss: 300, maxCpLoss: 500, weight: 8, complexityMultiplier: 1.8 },
      { minCpLoss: 500, maxCpLoss: 700, weight: 2, complexityMultiplier: 2.5 }
    ],
    personality: {
      checks: 82, captures: 62, threats: 52, development: 18, center: 14,
      castling: 4, safety: -8, defense: -12, simplification: -18, knights: 38,
      pawnMoves: 5, edgePawns: -5, earlyQueen: 25, repeatedPiece: 10, unforcedKing: -105
    },
    description: "An energetic attacker who loves checks, captures, threats, and knight adventures."
  },
  {
    id: "bishop",
    name: "Benny Bishop",
    title: "Careful Learner",
    estimatedRating: 775,
    multiPv: 8,
    thinkTimeMs: 320,
    tacticalAwareness: 0.56,
    complexitySensitivity: 0.9,
    qualityDiscipline: 0.34,
    selectionTemperature: 44,
    maxPlausibleCpLoss: 450,
    errorBands: [
      { minCpLoss: 0, maxCpLoss: 50, weight: 42, complexityMultiplier: 0 },
      { minCpLoss: 50, maxCpLoss: 100, weight: 28, complexityMultiplier: 0.25 },
      { minCpLoss: 100, maxCpLoss: 200, weight: 21, complexityMultiplier: 0.8 },
      { minCpLoss: 200, maxCpLoss: 400, weight: 8, complexityMultiplier: 1.7 },
      { minCpLoss: 400, maxCpLoss: 450, weight: 1, complexityMultiplier: 2.2 }
    ],
    personality: {
      checks: 24, captures: 26, threats: 24, development: 55, center: 42,
      castling: 68, safety: 42, defense: 35, simplification: 8, knights: 5,
      pawnMoves: -8, edgePawns: -28, earlyQueen: -58, repeatedPiece: -30, unforcedKing: -135
    },
    description: "A lesson-taking student who develops, fights for the center, and tries to castle."
  },
  {
    id: "rook",
    name: "Rocky Rook",
    title: "Solid Defender",
    estimatedRating: 975,
    multiPv: 7,
    thinkTimeMs: 400,
    tacticalAwareness: 0.75,
    complexitySensitivity: 0.65,
    qualityDiscipline: 0.52,
    selectionTemperature: 32,
    maxPlausibleCpLoss: 300,
    errorBands: [
      { minCpLoss: 0, maxCpLoss: 40, weight: 52, complexityMultiplier: 0 },
      { minCpLoss: 40, maxCpLoss: 80, weight: 25, complexityMultiplier: 0.2 },
      { minCpLoss: 80, maxCpLoss: 180, weight: 19, complexityMultiplier: 0.8 },
      { minCpLoss: 180, maxCpLoss: 300, weight: 4, complexityMultiplier: 1.8 }
    ],
    personality: {
      checks: 8, captures: 18, threats: 12, development: 52, center: 28,
      castling: 78, safety: 72, defense: 82, simplification: 58, knights: 0,
      pawnMoves: -8, edgePawns: -35, earlyQueen: -72, repeatedPiece: -42, unforcedKing: -160
    },
    description: "A cautious defender who protects pieces, castles, and prefers low-risk plans."
  },
  {
    id: "queen",
    name: "Quinn Queen",
    title: "Balanced Club Player",
    estimatedRating: 1225,
    multiPv: 6,
    thinkTimeMs: 520,
    tacticalAwareness: 0.9,
    complexitySensitivity: 0.45,
    qualityDiscipline: 0.72,
    selectionTemperature: 24,
    maxPlausibleCpLoss: 240,
    errorBands: [
      { minCpLoss: 0, maxCpLoss: 30, weight: 58, complexityMultiplier: 0 },
      { minCpLoss: 30, maxCpLoss: 60, weight: 22, complexityMultiplier: 0.2 },
      { minCpLoss: 60, maxCpLoss: 140, weight: 16, complexityMultiplier: 0.7 },
      { minCpLoss: 140, maxCpLoss: 240, weight: 4, complexityMultiplier: 1.6 }
    ],
    personality: {
      checks: 20, captures: 24, threats: 30, development: 48, center: 38,
      castling: 58, safety: 58, defense: 54, simplification: 24, knights: 0,
      pawnMoves: -10, edgePawns: -38, earlyQueen: -74, repeatedPiece: -48, unforcedKing: -175
    },
    description: "A balanced club player with natural development, short calculation, and human mistakes."
  },
  {
    id: "so-pawny",
    name: "Sir Lem",
    title: "Founder’s Mirror",
    estimatedRating: 1600,
    multiPv: 10,
    thinkTimeMs: 620,
    tacticalAwareness: 0.92,
    complexitySensitivity: 0.58,
    qualityDiscipline: 0.78,
    selectionTemperature: 28,
    maxPlausibleCpLoss: 190,
    errorBands: [
      { minCpLoss: 0, maxCpLoss: 25, weight: 50, complexityMultiplier: 0 },
      { minCpLoss: 25, maxCpLoss: 60, weight: 25, complexityMultiplier: 0.2 },
      { minCpLoss: 60, maxCpLoss: 120, weight: 18, complexityMultiplier: 0.8 },
      { minCpLoss: 120, maxCpLoss: 190, weight: 7, complexityMultiplier: 1.7 }
    ],
    personality: {
      checks: 58, captures: 42, threats: 62, development: 38, center: 46,
      castling: 30, safety: 20, defense: 25, simplification: -30, knights: 22,
      pawnMoves: 18, edgePawns: 25, earlyQueen: -65, repeatedPiece: 18, unforcedKing: -105
    },
    openingBook: [
      { after: [], moves: [{ uci: "e2e4", bonus: 100 }, { uci: "e2e3", bonus: 82 }, { uci: "d2d4", bonus: 58 }, { uci: "c2c4", bonus: 42 }] },
      { after: ["e2e4"], moves: [{ uci: "d7d6", bonus: 110 }, { uci: "e7e5", bonus: 45 }, { uci: "c7c5", bonus: 38 }] },
      { after: ["d2d4"], moves: [{ uci: "d7d6", bonus: 100 }, { uci: "g8f6", bonus: 58 }, { uci: "e7e6", bonus: 36 }] },
      { after: ["c2c4"], moves: [{ uci: "d7d6", bonus: 92 }, { uci: "g8f6", bonus: 54 }, { uci: "e7e5", bonus: 34 }] },
      { after: ["e2e4", "d7d6"], moves: [{ uci: "d2d4", bonus: 86 }, { uci: "g1f3", bonus: 50 }] },
      { after: ["e2e4", "e7e5"], moves: [{ uci: "g1f3", bonus: 90 }] },
      { after: ["e2e4", "e7e5", "g1f3", "b8c6"], moves: [{ uci: "d2d4", bonus: 105 }, { uci: "f1c4", bonus: 65 }] },
      { after: ["e2e4", "e7e5", "g1f3"], moves: [{ uci: "g8f6", bonus: 105 }, { uci: "b8c6", bonus: 52 }] },
      { after: ["e2e4", "e7e5", "g1f3", "g8f6"], moves: [{ uci: "f3e5", bonus: 72 }] },
      { after: ["e2e4", "e7e5", "g1f3", "g8f6", "f3e5"], moves: [{ uci: "b8c6", bonus: 112 }, { uci: "d7d6", bonus: 48 }] },
      { after: ["e2e4", "e7e5", "g1f3", "g8f6", "f3e5", "b8c6", "e5c6"], moves: [{ uci: "d7c6", bonus: 118 }] },
      { after: ["e2e4", "d7d6", "d2d4", "g8f6"], moves: [{ uci: "b1c3", bonus: 86 }] },
      { after: ["e2e4", "d7d6", "d2d4", "g8f6", "b1c3"], moves: [{ uci: "g7g6", bonus: 105 }] }
    ],
    description: "Modeled from 300 public games: 1.e4/1.e3, Pirc setups, Scotch ideas, pawn storms, and tactical attacks."
  }
];

export const TIME_CONTROLS: TimeControl[] = [
  { id: "none", name: "No Clock", initialMs: null, incrementMs: 0 },
  { id: "10m", name: "10 min", initialMs: 10 * 60_000, incrementMs: 0 },
  { id: "10+5", name: "10 + 5", initialMs: 10 * 60_000, incrementMs: 5_000 },
  { id: "15+10", name: "15 + 10", initialMs: 15 * 60_000, incrementMs: 10_000 }
];

export function resolvePlayerColor(choice: PlayerColorChoice, random = Math.random): ChessColor {
  if (choice !== "random") return choice;
  return random() < 0.5 ? "white" : "black";
}

export function oppositeColor(color: ChessColor): ChessColor {
  return color === "white" ? "black" : "white";
}

export function chessJsColor(color: ChessColor) {
  return color === "white" ? "w" as const : "b" as const;
}

export function fromChessJsColor(color: "w" | "b"): ChessColor {
  return color === "w" ? "white" : "black";
}
