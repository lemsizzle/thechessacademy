import { Chess } from "chess.js";
import { ENDGAME_TOPICS } from "./catalog";
import type { EndgameDifficulty } from "./generator";

export type EndgameAttempt = { fen: string; moves: string[]; assisted: boolean; completed: boolean; difficulty?: EndgameDifficulty; rewardToken?: string; candidateIndex?: number; rewardXp?: number };
export type EndgameProgress = { selected: string | null; attempts: Record<string, EndgameAttempt>; difficulty?: EndgameDifficulty };

export function replayEndgame(fen: string, moves: readonly string[]) {
  const game = new Chess(fen);
  for (const uci of moves) {
    if (game.isGameOver() || !/^([a-h][1-8]){2}[qrbn]?$/.test(uci)) throw new Error("Invalid practice move");
    game.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
  }
  return game;
}

export function endgameResult(game: Chess, player: "w" | "b") {
  if (game.isCheckmate()) return game.turn() !== player
    ? { won: true, title: "Win converted!", message: "Checkmate! You played the position all the way to a win." }
    : { won: false, title: "Try another plan", message: "Your king was checkmated. Take back a turn or restart and try a safer plan." };
  if (game.isStalemate()) return { won: false, title: "Stalemate", message: "The opponent has no legal move but is not in check. This is a draw. Take back a turn and leave an escape square until you can mate." };
  if (game.isInsufficientMaterial()) return { won: false, title: "Not enough material", message: "There is not enough material left to force checkmate. Take back a turn and protect your winning pieces or pawns." };
  if (game.isThreefoldRepetition()) return { won: false, title: "Repeated position", message: "The same position occurred three times. Try a different plan to make progress." };
  if (game.isDrawByFiftyMoves()) return { won: false, title: "50-move draw", message: "Fifty moves by each side passed without a capture or pawn move. Restart and work toward mate more directly." };
  if (game.isDraw()) return { won: false, title: "Draw", message: "The position is drawn. Take back a turn or restart to try again." };
  return null;
}

/** Return to the start of the learner's previous turn, even during a CPU reply. */
export function takeBackEndgame(fen: string, moves: readonly string[]) {
  const next = moves.slice(0, -1);
  const player = new Chess(fen).turn();
  while (next.length && replayEndgame(fen, next).turn() !== player) next.pop();
  return next;
}

export function readEndgameProgress(raw: string | null): EndgameProgress {
  const result: EndgameProgress = { selected: null, attempts: {} };
  if (!raw) return result;
  try {
    const saved = JSON.parse(raw);
    if (saved.difficulty === "standard" || saved.difficulty === "challenge") result.difficulty = saved.difficulty;
    for (const topic of ENDGAME_TOPICS) {
      const attempt = saved.attempts?.[topic.id];
      if (!attempt || typeof attempt.fen !== "string" || !Array.isArray(attempt.moves) || attempt.moves.length > 1000) continue;
      try {
        if (new Chess(attempt.fen).isGameOver()) continue;
        replayEndgame(attempt.fen, attempt.moves);
        result.attempts[topic.id] = {
          fen: attempt.fen, moves: attempt.moves, assisted: attempt.assisted === true, completed: attempt.completed === true,
          ...(attempt.difficulty === "standard" || attempt.difficulty === "challenge" ? { difficulty: attempt.difficulty } : {}),
          ...(typeof attempt.rewardToken === "string" && attempt.rewardToken.length <= 2048 && Number.isInteger(attempt.candidateIndex) && attempt.candidateIndex >= 0 && attempt.candidateIndex < 20 ? { rewardToken: attempt.rewardToken, candidateIndex: attempt.candidateIndex } : {}),
          ...(attempt.rewardXp === 3 ? { rewardXp: 3 } : {})
        };
      } catch { /* Discard only the damaged attempt; other practice stays available. */ }
    }
    if (ENDGAME_TOPICS.some(topic => topic.id === saved.selected)) result.selected = saved.selected;
  } catch { /* A damaged browser save must never block training. */ }
  return result;
}
