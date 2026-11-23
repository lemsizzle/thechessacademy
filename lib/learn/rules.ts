import { Chess, type Move, type Square } from "chess.js";
import type { LearnPosition } from "./types";

export const pieceName: Record<string, string> = { p: "pawn", n: "knight", b: "bishop", r: "rook", q: "queen", k: "king" };
const pieceValue: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
export const uci = (move: Move) => move.from + move.to + (move.promotion ?? "");
export function playUci(game: Chess, move: string) {
  return game.move({ from: move.slice(0, 2), to: move.slice(2, 4), ...(move[4] ? { promotion: move[4] } : {}) });
}
export function kingSquare(game: Chess, color: "w" | "b") {
  return game.board().flat().find(piece => piece?.type === "k" && piece.color === color)!.square;
}
export function sameRay(from: string, middle: string, behind: string, piece: string) {
  const dx = behind.charCodeAt(0) - from.charCodeAt(0), dy = Number(behind[1]) - Number(from[1]);
  const mx = middle.charCodeAt(0) - from.charCodeAt(0), my = Number(middle[1]) - Number(from[1]);
  const diagonal = Math.abs(dx) === Math.abs(dy) && dx !== 0;
  const straight = (dx === 0) !== (dy === 0);
  return (piece === "q" ? diagonal || straight : piece === "b" ? diagonal : piece === "r" && straight)
    && dx * my === dy * mx && mx * dx + my * dy > 0 && Math.max(Math.abs(mx), Math.abs(my)) < Math.max(Math.abs(dx), Math.abs(dy));
}

// Authoring/test validator. The student downloads a small, prevalidated answer
// key; no engine, database, or search is needed while playing Learn puzzles.
export function achievesGoal(position: LearnPosition, move: Move): boolean {
  const before = new Chess(position.fen), after = new Chess(move.after);
  const target = position.target as Square | undefined;
  if (position.topic === "mate-in-one") return after.isCheckmate();
  if (position.topic === "hanging-piece") return move.to === target && Boolean(move.captured)
    && !before.isAttacked(target!, "b") && !after.isAttacked(move.to, "b");
  if (position.topic === "defensive-move") {
    if (position.kind === "escape") return move.from === position.focus && !after.isAttacked(move.to, "b");
    if (position.kind === "block") return before.isCheck() && move.piece !== "k" && !move.captured && after.isAttacked(move.to, "b")
      && after.isAttacked(move.to, "w") && move.piece !== "q"; // A protected block: the rook cannot win this piece for free.
    return before.isCheck() && move.to === target && Boolean(move.captured) && !after.isAttacked(move.to, "b");
  }
  if (move.captured || move.piece === "k" || !target || after.isGameOver()) return false;
  const king = kingSquare(after, "b");
  if (position.topic === "pins") {
    return !after.isCheck() && sameRay(move.to, target, king, move.piece)
      && after.attackers(target, "w").includes(move.to)
      && !after.isAttacked(move.to, "b")
      && !after.moves({ verbose: true }).some(reply => reply.from === target);
  }
  if (!after.isCheck()) return false;
  if (position.topic === "forks" && !after.attackers(target, "w").includes(move.to)) return false;
  if (position.topic === "skewers" && !sameRay(move.to, king, target, move.piece)) return false;
  // Every legal defense must leave the advertised target available. A puzzle
  // never promises a fork/skewer payoff that the opponent can refute.
  return after.moves({ verbose: true }).every(reply => {
    const next = new Chess(reply.after);
    return next.get(move.to)?.color === "w" && next.get(target)?.color === "b"
      && next.moves({ verbose: true }).some(capture => capture.from === move.to && capture.to === target && Boolean(capture.captured)
        && (pieceValue[capture.captured!] > pieceValue[capture.piece] || !new Chess(capture.after).isAttacked(capture.to, "b")));
  });
}

export function acceptedLearnMoves(position: LearnPosition) {
  return new Chess(position.fen).moves({ verbose: true }).filter(move => achievesGoal(position, move)).map(uci).sort();
}

export function learnPrompt(position: LearnPosition) {
  const game = new Chess(position.fen);
  if (position.topic === "mate-in-one") return "Checkmate Black in one move.";
  if (position.topic === "hanging-piece") return `Capture the undefended ${pieceName[game.get(position.target as Square)!.type]}.`;
  if (position.topic === "defensive-move") return position.kind === "escape" ? `Save your attacked ${pieceName[game.get(position.focus as Square)!.type]}. Move it to a safe square.` : position.kind === "block" ? "Your king is in check. Block the rook’s line with a piece your king protects." : "Your king is in check. Capture the checking piece safely.";
  if (position.topic === "forks") return `Check the king and attack the ${pieceName[game.get(position.target as Square)!.type]} with the same piece.`;
  if (position.topic === "pins") return `Pin the ${pieceName[game.get(position.target as Square)!.type]} to its king.`;
  return `Check the king so it must uncover the ${pieceName[game.get(position.target as Square)!.type]} behind it.`;
}

export function learnExplanation(position: LearnPosition, answer: string) {
  const before = new Chess(position.fen), moved = playUci(before, answer);
  const subject = `Your ${pieceName[moved.piece]}`;
  if (position.topic === "mate-in-one") return `${moved.san} is checkmate: the king is in check, and Black has no legal capture, block, or escape to stop it.`;
  if (position.topic === "hanging-piece") return `${subject} captures the undefended ${pieceName[moved.captured!]} on ${moved.to}. No black piece can recapture it there.`;
  if (position.topic === "defensive-move") return position.kind === "escape" ? `${subject} is safe on ${moved.to}. The threatened piece is no longer under attack.` : position.kind === "block" ? `${subject} on ${moved.to} blocks the rook’s line. Your king protects the blocking piece, so the rook cannot win it for free.` : `${subject} captures the checking ${pieceName[moved.captured!]}. The check is stopped and your capturing piece is safe.`;
  const target = pieceName[before.get(position.target as Square)!.type];
  if (position.topic === "pins") return `${subject} on ${moved.to} lines up the ${target} on ${position.target} and the king behind it. That ${target} has no legal move: moving it would expose its king to check. This is an absolute pin.`;
  if (position.topic === "forks") return `${subject} on ${moved.to} attacks the king and the ${target} on ${position.target}. Black must answer the check, then you can take the ${target}.`;
  return `${subject} checks the king in front of the ${target}. After Black answers the check, you can capture the ${target} on ${position.target}.`;
}

export function learnFollowUp(position: LearnPosition, answer: string) {
  if (position.topic !== "forks" && position.topic !== "skewers") return [];
  const game = new Chess(position.fen);
  const first = playUci(game, answer), reply = game.moves({ verbose: true })[0];
  if (!reply) return [];
  game.move(reply);
  const capture = game.moves({ verbose: true }).find(move => move.from === first.to && move.to === position.target);
  return capture ? [reply, capture] : [];
}
