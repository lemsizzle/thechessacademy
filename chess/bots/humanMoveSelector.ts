import { Chess, SQUARES, type Color, type Move, type PieceSymbol, type Square } from "chess.js";
import type { BotDifficulty, BotErrorBand, BotMoveContext, StockfishCandidate } from "@/chess/types";

const PIECE_VALUE: Record<PieceSymbol, number> = {
  p: 100,
  n: 320,
  b: 330,
  r: 500,
  q: 900,
  k: 0
};

type CandidateFeatures = {
  check: number;
  capture: number;
  threat: number;
  development: number;
  center: number;
  castle: number;
  safety: number;
  defense: number;
  simplification: number;
  knight: number;
  pawnMove: number;
  edgePawn: number;
  earlyQueen: number;
  repeatedPiece: number;
  unforcedKing: number;
};

export type ScoredHumanCandidate = {
  candidate: StockfishCandidate;
  cpLoss: number;
  features: CandidateFeatures;
  personalityScore: number;
  totalScore: number;
};

function otherColor(color: Color): Color {
  return color === "w" ? "b" : "w";
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

function engineScore(candidate: StockfishCandidate) {
  if (candidate.mate !== null) {
    return candidate.mate > 0
      ? 100_000 - Math.min(candidate.mate, 100) * 100
      : -100_000 - Math.max(candidate.mate, -100) * 100;
  }
  return candidate.scoreCp ?? -100_000;
}

function moveUci(move: Move) {
  return `${move.from}${move.to}${move.promotion ?? ""}`;
}

function attackedMaterial(chess: Chess, color: Color) {
  const enemy = otherColor(color);
  let danger = 0;
  for (const square of SQUARES) {
    const piece = chess.get(square);
    if (!piece || piece.color !== color || piece.type === "k") continue;
    const attackers = chess.attackers(square, enemy);
    if (!attackers.length) continue;
    const defenders = chess.attackers(square, color);
    const cheapestAttacker = Math.min(...attackers.map((attacker) => PIECE_VALUE[chess.get(attacker)?.type ?? "q"]));
    const pieceValue = PIECE_VALUE[piece.type];
    if (!defenders.length) danger += pieceValue;
    else if (cheapestAttacker < pieceValue) danger += pieceValue - cheapestAttacker;
  }
  return danger;
}

function materialBalance(chess: Chess, color: Color) {
  let balance = 0;
  for (const square of SQUARES) {
    const piece = chess.get(square);
    if (!piece) continue;
    const value = PIECE_VALUE[piece.type];
    balance += piece.color === color ? value : -value;
  }
  return balance;
}

function kingExposure(chess: Chess, color: Color) {
  const kingSquare = SQUARES.find((square) => {
    const piece = chess.get(square);
    return piece?.color === color && piece.type === "k";
  });
  if (!kingSquare) return 1;

  const file = kingSquare.charCodeAt(0) - 97;
  const rank = Number(kingSquare[1]);
  const shieldRank = rank + (color === "w" ? 1 : -1);
  let shield = 0;
  for (const shieldFile of [file - 1, file, file + 1]) {
    if (shieldFile < 0 || shieldFile > 7 || shieldRank < 1 || shieldRank > 8) continue;
    const square = `${String.fromCharCode(97 + shieldFile)}${shieldRank}` as Square;
    const piece = chess.get(square);
    if (piece?.color === color && piece.type === "p") shield += 1;
  }
  const directAttackers = chess.attackers(kingSquare, otherColor(color)).length;
  return clamp((3 - shield) / 3 + directAttackers * 0.35, 0, 1.5);
}

export function estimatePositionComplexity(fen: string) {
  const chess = new Chess(fen);
  const side = chess.turn();
  const enemy = otherColor(side);
  let captures = 0;
  let checks = 0;
  for (const move of chess.moves({ verbose: true })) {
    if (move.isCapture()) captures += 1;
    const next = new Chess(fen);
    next.move({ from: move.from, to: move.to, promotion: move.promotion });
    if (next.inCheck()) checks += 1;
  }
  const looseMaterial = attackedMaterial(chess, side) + attackedMaterial(chess, enemy);
  const exposedKings = kingExposure(chess, side) + kingExposure(chess, enemy);
  return clamp(
    captures * 0.07 + checks * 0.1 + Math.min(looseMaterial, 1800) / 3600 + exposedKings * 0.12 + (chess.inCheck() ? 0.2 : 0),
    0,
    1
  );
}

export function adjustedErrorBandWeights(bot: BotDifficulty, complexity: number) {
  return bot.errorBands.map((band) => {
    const humanErrorFactor = 1 - bot.tacticalAwareness;
    const complexityBoost = complexity * bot.complexitySensitivity * humanErrorFactor * band.complexityMultiplier;
    return band.weight * (1 + complexityBoost);
  });
}

function selectErrorBand(bot: BotDifficulty, complexity: number, random: () => number) {
  const weights = adjustedErrorBandWeights(bot, complexity);
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  let cursor = clamp(random(), 0, 0.999999) * total;
  for (const [index, band] of bot.errorBands.entries()) {
    cursor -= weights[index];
    if (cursor <= 0) return band;
  }
  return bot.errorBands.at(-1) as BotErrorBand;
}

function candidateFeatures(chess: Chess, move: Move, context: BotMoveContext): CandidateFeatures {
  const side = chess.turn();
  const enemy = otherColor(side);
  const fullMove = Number(chess.fen().split(" ")[5] ?? 1);
  const beforeDanger = attackedMaterial(chess, side);
  const sourceWasAttacked = chess.attackers(move.from, enemy).length > 0;
  const priorBotMove = context.moveHistory.at(-2);
  const repeatedPiece = priorBotMove?.slice(2, 4) === move.from;
  const isCastle = move.isKingsideCastle() || move.isQueensideCastle();
  const startingRank = side === "w" ? "1" : "8";
  const next = new Chess(chess.fen());
  next.move({ from: move.from, to: move.to, promotion: move.promotion });
  const afterDanger = attackedMaterial(next, side);

  let threatenedValue = 0;
  for (const square of SQUARES) {
    const piece = next.get(square);
    if (!piece || piece.color !== enemy || piece.type === "k") continue;
    if (next.attackers(square, side).includes(move.to)) threatenedValue = Math.max(threatenedValue, PIECE_VALUE[piece.type]);
  }

  const safetySwing = clamp((beforeDanger - afterDanger) / 500, -2, 2);
  const balance = materialBalance(next, side);
  return {
    check: next.inCheck() ? 1 : 0,
    capture: move.isCapture() ? 1 + PIECE_VALUE[move.captured ?? "p"] / 900 : 0,
    threat: threatenedValue / 900,
    development: (move.piece === "n" || move.piece === "b") && move.from[1] === startingRank && move.to[1] !== startingRank ? 1 : 0,
    center: ["d4", "e4", "d5", "e5"].includes(move.to) ? 1 : 0,
    castle: isCastle ? 1 : 0,
    safety: safetySwing,
    defense: sourceWasAttacked || safetySwing > 0.25 ? 1 : 0,
    simplification: move.isCapture() && balance > 150 ? 1 : 0,
    knight: move.piece === "n" ? 1 : 0,
    pawnMove: move.piece === "p" ? 1 : 0,
    edgePawn: move.piece === "p" && (move.from[0] === "a" || move.from[0] === "h") ? 1 : 0,
    earlyQueen: move.piece === "q" && fullMove <= 8 ? 1 : 0,
    repeatedPiece: repeatedPiece ? 1 : 0,
    unforcedKing: move.piece === "k" && !isCastle && !chess.inCheck() ? 1 : 0
  };
}

function personalityScore(bot: BotDifficulty, features: CandidateFeatures) {
  const personality = bot.personality;
  return (
    features.check * personality.checks +
    features.capture * personality.captures +
    features.threat * personality.threats +
    features.development * personality.development +
    features.center * personality.center +
    features.castle * personality.castling +
    features.safety * personality.safety +
    features.defense * (personality.defense + bot.tacticalAwareness * 35) +
    features.simplification * personality.simplification +
    features.knight * personality.knights +
    features.pawnMove * personality.pawnMoves +
    features.edgePawn * personality.edgePawns +
    features.earlyQueen * personality.earlyQueen +
    features.repeatedPiece * personality.repeatedPiece +
    features.unforcedKing * personality.unforcedKing
  );
}

function openingBookBonus(bot: BotDifficulty, uci: string, context: BotMoveContext) {
  const rule = bot.openingBook?.find((entry) => entry.after.length === context.moveHistory.length
    && entry.after.every((move, index) => move === context.moveHistory[index]));
  const choiceIndex = rule?.moves.findIndex((move) => move.uci === uci) ?? -1;
  if (!rule || choiceIndex < 0) return 0;
  const frequencyRankBonus = [65, 35, 18, 8][choiceIndex] ?? 0;
  return rule.moves[choiceIndex].bonus + frequencyRankBonus;
}

export function scoreHumanCandidates(
  fen: string,
  candidates: StockfishCandidate[],
  bot: BotDifficulty,
  context: BotMoveContext = { moveHistory: [] }
) {
  const chess = new Chess(fen);
  const legalMoves = new Map(chess.moves({ verbose: true }).map((move) => [moveUci(move), move]));
  const uniqueCandidates = [...new Map(candidates.map((candidate) => [candidate.uci, candidate])).values()]
    .filter((candidate) => legalMoves.has(candidate.uci));
  if (!uniqueCandidates.length) return [];
  const bestScore = Math.max(...uniqueCandidates.map(engineScore));

  return uniqueCandidates.map((candidate): ScoredHumanCandidate => {
    const cpLoss = Math.max(0, bestScore - engineScore(candidate));
    const features = candidateFeatures(chess, legalMoves.get(candidate.uci) as Move, context);
    const humanScore = personalityScore(bot, features) + openingBookBonus(bot, candidate.uci, context);
    return {
      candidate,
      cpLoss,
      features,
      personalityScore: humanScore,
      totalScore: humanScore - cpLoss * bot.qualityDiscipline
    };
  }).sort((left, right) => left.candidate.rank - right.candidate.rank);
}

function distanceFromBand(cpLoss: number, band: BotErrorBand) {
  if (cpLoss < band.minCpLoss) return band.minCpLoss - cpLoss;
  if (cpLoss > band.maxCpLoss) return cpLoss - band.maxCpLoss;
  return 0;
}

function weightedCandidate(candidates: ScoredHumanCandidate[], temperature: number, random: () => number) {
  if (candidates.length === 1) return candidates[0];
  const highestScore = Math.max(...candidates.map((candidate) => candidate.totalScore));
  const weights = candidates.map((candidate) => Math.exp(clamp((candidate.totalScore - highestScore) / temperature, -12, 0)));
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  let cursor = clamp(random(), 0, 0.999999) * total;
  for (const [index, candidate] of candidates.entries()) {
    cursor -= weights[index];
    if (cursor <= 0) return candidate;
  }
  return candidates.at(-1) as ScoredHumanCandidate;
}

export function selectHumanLikeMove({
  fen,
  candidates,
  bot,
  context = { moveHistory: [] },
  random = Math.random
}: {
  fen: string;
  candidates: StockfishCandidate[];
  bot: BotDifficulty;
  context?: BotMoveContext;
  random?: () => number;
}) {
  const scored = scoreHumanCandidates(fen, candidates, bot, context);
  if (!scored.length) throw new Error("Stockfish did not return a legal candidate move.");

  const plausible = scored.filter((candidate) => candidate.cpLoss <= bot.maxPlausibleCpLoss || candidate.candidate.rank === 1);
  const withoutStrangeKingMoves = plausible.filter((candidate) => !candidate.features.unforcedKing);
  const candidateSet = withoutStrangeKingMoves.length >= 2 ? withoutStrangeKingMoves : plausible;
  const complexity = estimatePositionComplexity(fen);
  const band = selectErrorBand(bot, complexity, random);
  const inBand = candidateSet.filter((candidate) => distanceFromBand(candidate.cpLoss, band) === 0);
  const pool = inBand.length
    ? inBand
    : candidateSet.filter((candidate) => distanceFromBand(candidate.cpLoss, band) === Math.min(...candidateSet.map((item) => distanceFromBand(item.cpLoss, band))));
  return weightedCandidate(pool, bot.selectionTemperature, random).candidate.uci;
}
