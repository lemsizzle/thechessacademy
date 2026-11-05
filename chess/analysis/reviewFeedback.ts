import { Chess, type Move } from "chess.js";
import type { StockfishCandidate } from "@/chess/types";
import { playReviewMove } from "./mistakeExploration";

const names = { p: "pawn", n: "knight", b: "bishop", r: "rook", q: "queen", k: "king" } as const;
const values = { p: 100, n: 300, b: 300, r: 500, q: 900, k: 0 } as const;

/** Explain only consequences supported by legal moves, not SAN punctuation alone. */
export function concreteMistakeReason(fen: string, playedUci: string, replyLineSan: string, allowsMate = false): string | null {
  const played = playReviewMove(fen, playedUci);
  if (!played) return null;
  const chess = new Chess(played.fen);
  const opponent = chess.turn();
  const line: Move[] = [];
  for (const san of replyLineSan.trim().split(/\s+/).slice(0, 8)) {
    try { line.push(chess.move(san)); } catch { break; }
  }
  const first = line[0];
  if (!first) return allowsMate ? `${played.san} allows checkmate. Your king can no longer escape with best defense.` : null;
  const shownLine = line.map((move) => move.san).join(" ");
  if (allowsMate || (chess.isCheckmate() && chess.turn() !== opponent)) {
    return `${played.san} allows checkmate${first.san.includes("#") ? ` with ${first.san}` : `: your opponent starts with ${first.san}`}. ${first.san.includes("#") ? "Your king has no safe escape, and the check cannot be captured or blocked." : `Watch the attack: ${shownLine}. Protect your king before starting your own plan.`}`;
  }
  let gain = 0;
  for (const move of line) {
    const amount = (move.captured ? values[move.captured] : 0) + (move.promotion ? values[move.promotion] - values.p : 0);
    gain += move.color === opponent ? amount : -amount;
  }
  const capture = line.filter((move) => move.color === opponent && move.captured)
    .sort((a, b) => values[b.captured!] - values[a.captured!])[0];
  if (capture?.captured && gain >= 100) {
    const target = capture.flags.includes("e") ? `${capture.to[0]}${capture.from[1]}` : capture.to;
    // Only call it hanging when the first capture stays a full piece ahead in
    // the calculated line. Exchanges and sacrifices get more cautious wording.
    const hangs = capture === first && gain >= values[capture.captured];
    return `${played.san} ${hangs ? `hangs your ${names[capture.captured]} on ${target}` : "loses material"}. Your opponent can ${capture === first ? "play" : `start with ${first.san}, then play`} ${capture.san} to capture your ${names[capture.captured]}${hangs ? "" : ` on ${target}`}.${!hangs && line.length > 1 ? ` Calculated line: ${shownLine}.` : ""} Look for a move that keeps your pieces safe or creates a stronger threat.`;
  }
  if (first.promotion && gain > 0) return `${played.san} lets the pawn on ${first.from} promote with ${first.san}. Look for a way to stop that pawn or a forcing move of your own.`;
  // A fair trade is not a hanging piece. Do not invent a material-loss claim
  // when the short engine line does not establish one.
  return `${played.san} gives your opponent the stronger continuation ${shownLine}. Look at what ${first.san} threatens, then compare ways to protect your king and keep your pieces active.`;
}

export function reviewHint(fen: string, bestMoveUci: string, level: number) {
  const piece = new Chess(fen).get(bestMoveUci.slice(0, 2) as never);
  if (!piece) return "Check your opponent's threat, then look at checks, captures, and safe moves.";
  const source = bestMoveUci.slice(0, 2);
  return level > 1
    ? `Try moving your ${names[piece.type]} from ${source} to ${bestMoveUci.slice(2, 4)}${bestMoveUci[4] ? ` and promoting to a ${names[bestMoveUci[4] as keyof typeof names]}` : ""}. Other good moves can work too.`
    : `Look at your ${names[piece.type]} on ${source}. What checks, captures, or safe squares does it have?`;
}

export type ReviewScore = { cp: number | null; mate: number | null };
// All scores are from the learner's perspective, regardless of board color.
export function isGoodReviewMove(best: ReviewScore, attempt: ReviewScore) {
  if (attempt.mate !== null) return attempt.mate > 0;
  if (best.mate !== null) return best.mate > 0 && attempt.cp !== null && attempt.cp >= 300;
  return best.cp !== null && attempt.cp !== null && best.cp - attempt.cp <= 75;
}

export async function scoreReviewMove(fen: string, uci: string, analyze: (fen: string, ms: number) => Promise<StockfishCandidate[]>): Promise<ReviewScore> {
  const played = playReviewMove(fen, uci);
  if (!played) throw new Error("This move is not legal in this position.");
  const chess = new Chess(played.fen);
  if (chess.isCheckmate()) return { cp: null, mate: 1 };
  if (chess.isDraw()) return { cp: 0, mate: null };
  const lines = await analyze(played.fen, 500);
  const line = lines.find((candidate) => candidate.rank === 1 && !candidate.bound);
  if (!line || (line.scoreCp === null && line.mate === null)) throw new Error("The engine could not check this move. Please try again.");
  // After the learner moves it is the opponent's turn: invert engine scores.
  return { cp: line.scoreCp === null ? null : -line.scoreCp, mate: line.mate === null ? null : -line.mate };
}
