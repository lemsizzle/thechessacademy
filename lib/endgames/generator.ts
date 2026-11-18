import { Chess, type PieceSymbol, type Square } from "chess.js";
import type { StockfishCandidate } from "@/chess/types";

type Token = { type: PieceSymbol; color: "w" | "b"; file: number; rank: number };
const square = (file: number, rank: number) => `${"abcdefgh"[file]}${rank}` as Square;

// Version 1 is also replayed by the reward verifier. Keep this deterministic;
// future generator changes must issue a new token version.
export function endgameCandidateFromSeed(topicId: string, seed: number, index: number) {
  let state = (seed ^ Math.imul(index + 1, 0x9e3779b9)) >>> 0;
  return generateEndgameCandidate(topicId, () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  });
}

/** Construct from randomized pieces and geometry, never a FEN list. Callers must
 * engine-check the result with winningCandidate before offering it to a learner.
 */
export function generateEndgameCandidate(topicId: string, random: () => number = Math.random): string {
  const pick = (min: number, max: number) => min + Math.floor(random() * (max - min + 1));
  for (let attempt = 0; attempt < 400; attempt++) {
    const tokens: Token[] = [];
    const add = (type: PieceSymbol, color: "w" | "b", file: number, rank: number) => tokens.push({ type, color, file, rank });
    const pawnFile = pick(1, 6);
    if (topicId === "king-and-pawn") {
      add("k", "w", pawnFile, 6); add("p", "w", pawnFile, pick(4, 5)); add("k", "b", pick(0, 7), 8);
    } else if (topicId === "rook-escort") {
      add("p", "w", pawnFile, pick(6, 7)); add("k", "w", pawnFile + (pawnFile < 4 ? 1 : -1), 6);
      add("r", "w", pawnFile, pick(1, 4)); add("k", "b", pawnFile < 4 ? 7 : 0, pick(7, 8)); add("r", "b", pick(0, 7), pick(2, 5));
    } else if (topicId === "connected-passers") {
      const file = pick(0, 4);
      add("p", "w", file, 6); add("p", "w", file + 1, pick(5, 6)); add("k", "w", pick(1, 5), pick(2, 4));
      add("k", "b", 7, pick(5, 7)); add("p", "b", pick(0, 2), 7);
    } else if (topicId === "outside-passer") {
      add("k", "w", pick(3, 5), 4); add("k", "b", pick(3, 6), 6);
      add("p", "w", pick(0, 1), pick(3, 5)); add("p", "w", 5, pick(3, 4)); add("p", "w", 6, 3);
      add("p", "b", 5, 6); add("p", "b", 6, pick(6, 7));
    } else if (topicId === "extra-bishop") {
      add("k", "w", pick(3, 6), pick(2, 4)); add("k", "b", pick(5, 7), 8);
      add("b", "w", pick(1, 5), pick(2, 5)); add("p", "w", pick(0, 1), pick(4, 6));
      for (const file of [6, 7]) { add("p", "w", file, pick(2, 3)); add("p", "b", file, pick(6, 7)); }
    } else if (["extra-queen", "extra-rook", "black-queen"].includes(topicId)) {
      add("k", "w", pick(5, 7), 1); add("k", "b", pick(5, 7), 8);
      for (const file of [5, 6, 7]) { add("p", "w", file, pick(2, 3)); add("p", "b", file, pick(6, 7)); }
      add(topicId === "extra-rook" ? "r" : "q", "w", pick(0, 4), pick(2, 5));
      if (topicId !== "extra-rook") add("r", "b", pick(0, 3), 8);
      if (topicId === "extra-queen") add("r", "w", pick(0, 3), 1);
    } else {
      add("k", "w", pick(1, 6), pick(2, 5)); add("k", "b", pick(0, 7), pick(6, 8));
      if (topicId === "queen-mate") add("q", "w", pick(0, 7), pick(1, 5));
      else if (topicId === "rook-mate") add("r", "w", pick(0, 7), pick(1, 5));
      else if (topicId === "ladder-mate") { add("r", "w", pick(0, 7), pick(1, 4)); add("r", "w", pick(0, 7), pick(1, 4)); }
      else if (topicId === "bishop-pair") {
        const file = pick(0, 7), rank = pick(1, 5);
        add("b", "w", file, rank);
        const secondFile = pick(0, 7), secondRank = pick(1, 5);
        if ((file + rank) % 2 === (secondFile + secondRank) % 2) continue;
        add("b", "w", secondFile, secondRank);
      } else throw new Error("Unknown endgame skill");
    }
    const reflect = random() < .5;
    const black = topicId === "black-queen" || random() < .5;
    const squares = new Set<string>();
    const game = new Chess(); game.clear();
    let collision = false;
    for (const token of tokens) {
      const target = square(reflect ? 7 - token.file : token.file, black ? 9 - token.rank : token.rank);
      if (squares.has(target)) { collision = true; break; }
      squares.add(target);
      game.put({ type: token.type, color: black ? (token.color === "w" ? "b" : "w") : token.color }, target);
    }
    if (collision) continue;
    const fen = game.fen().replace(/ [wb] /, black ? " b " : " w ");
    const candidate = new Chess(fen);
    const otherTurn = new Chess(fen.replace(/ [wb] /, black ? " w " : " b "));
    // Neither king starts in check; this also excludes adjacent kings.
    if (candidate.isCheck() || otherTurn.isCheck() || candidate.isGameOver() || candidate.moves().length < 3) continue;
    return fen;
  }
  throw new Error("Could not construct a legal position. Please try again.");
}

export function winningCandidate(line: StockfishCandidate | undefined) {
  if (!line || line.bound || line.depth < 10) return false;
  // These exercises are about playing out a win, not a mate-in-one diagram.
  return line.mate !== null ? line.mate > 1 : line.scoreCp !== null && line.scoreCp >= 550;
}
