import { Chess } from "chess.js";
import { BOT_DIFFICULTIES, TIME_CONTROLS, oppositeColor } from "@/chess/game/config";
import { detectBoardOutcome, resultHeader } from "@/chess/game/rules";
import type { ChessColor, GameMove, GameOutcome, GameResult, GameResultReason, PromotionPiece } from "@/chess/types";

const RESULT_REASONS = new Set<GameResultReason>([
  "checkmate", "stalemate", "resignation", "timeout", "threefold_repetition", "fifty_move_rule", "insufficient_material", "draw"
]);
const BOARD_REASONS = new Set<GameResultReason>([
  "checkmate", "stalemate", "threefold_repetition", "fifty_move_rule", "insufficient_material", "draw"
]);

export type CompletedGamePayload = {
  opponentId: string;
  opponentName: string;
  playerColor: ChessColor;
  result: GameResult;
  resultReason: GameResultReason;
  winnerColor: ChessColor | null;
  timeControlId: string;
  initialFen: string;
  finalFen: string;
  pgn: string;
  moves: Array<Pick<GameMove, "from" | "to" | "promotion">>;
  startedAt: string;
  completedAt: string;
};

function objectValue(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid completed game payload.");
  return value as Record<string, unknown>;
}
function colorValue(value: unknown, nullable = false): ChessColor | null {
  if (nullable && value === null) return null;
  if (value === "white" || value === "black") return value;
  throw new Error("Invalid player color.");
}

function cleanMoves(value: unknown) {
  if (!Array.isArray(value) || value.length > 1000) throw new Error("Invalid move list.");
  return value.map((raw) => {
    const move = objectValue(raw);
    const from = String(move.from ?? "");
    const to = String(move.to ?? "");
    const promotion = move.promotion === undefined ? undefined : String(move.promotion);
    if (!/^[a-h][1-8]$/.test(from) || !/^[a-h][1-8]$/.test(to)) throw new Error("Invalid move coordinates.");
    if (promotion !== undefined && !["q", "r", "b", "n"].includes(promotion)) throw new Error("Invalid promotion piece.");
    return { from, to, promotion: promotion as PromotionPiece | undefined };
  });
}

export function validateCompletedGame(input: unknown) {
  const body = objectValue(input);
  const opponentId = String(body.opponentId ?? "");
  const bot = BOT_DIFFICULTIES.find((item) => item.id === opponentId);
  if (!bot) throw new Error("Invalid computer opponent.");
  const control = TIME_CONTROLS.find((item) => item.id === String(body.timeControlId ?? ""));
  if (!control) throw new Error("Invalid time control.");
  const playerColor = colorValue(body.playerColor) as ChessColor;
  const winnerColor = colorValue(body.winnerColor, true);
  const result = body.result;
  if (result !== "win" && result !== "loss" && result !== "draw") throw new Error("Invalid game result.");
  const resultReason = String(body.resultReason ?? "") as GameResultReason;
  if (!RESULT_REASONS.has(resultReason)) throw new Error("Invalid result reason.");
  const expectedResult = winnerColor === null ? "draw" : winnerColor === playerColor ? "win" : "loss";
  if (result !== expectedResult) throw new Error("Game result does not match the winner.");

  const startedAt = new Date(String(body.startedAt ?? ""));
  const completedAt = new Date(String(body.completedAt ?? ""));
  if (!Number.isFinite(startedAt.getTime()) || !Number.isFinite(completedAt.getTime()) || completedAt < startedAt) {
    throw new Error("Invalid game timestamps.");
  }

  const initialFen = String(body.initialFen ?? "");
  let chess: Chess;
  try {
    chess = new Chess(initialFen);
  } catch {
    throw new Error("Invalid initial position.");
  }
  const moves = cleanMoves(body.moves);
  const savedMoves: GameMove[] = [];
  for (const [index, inputMove] of moves.entries()) {
    let move;
    try {
      move = chess.move(inputMove);
    } catch {
      throw new Error(`Illegal move at ply ${index + 1}.`);
    }
    savedMoves.push({
      ply: index + 1,
      color: move.color === "w" ? "white" : "black",
      san: move.san,
      from: move.from,
      to: move.to,
      promotion: move.promotion as PromotionPiece | undefined,
      fenAfter: chess.fen()
    });
  }

  if (String(body.finalFen ?? "") !== chess.fen()) throw new Error("Final position does not match the move list.");
  if (BOARD_REASONS.has(resultReason)) {
    const detected = detectBoardOutcome(chess, playerColor);
    if (!detected || detected.reason !== resultReason || detected.result !== result || detected.winnerColor !== winnerColor) {
      throw new Error("The board position does not match the reported result.");
    }
  } else if (resultReason === "resignation" && winnerColor !== oppositeColor(playerColor)) {
    throw new Error("The resignation result is invalid.");
  }

  const outcome: GameOutcome = {
    result,
    reason: resultReason,
    winnerColor,
    title: "",
    message: ""
  };
  const date = startedAt.toISOString().slice(0, 10).replaceAll("-", ".");
  chess.header(
    "Event", "Chess Academy vs Computer",
    "Site", "The Chess Academy",
    "Date", date,
    "White", playerColor === "white" ? "Student" : bot.name,
    "Black", playerColor === "black" ? "Student" : bot.name,
    "Result", resultHeader(outcome),
    "Termination", resultReason.replaceAll("_", " ")
  );

  return {
    opponentType: "computer" as const,
    opponentId: bot.id,
    opponentName: bot.name,
    playerColor,
    result,
    resultReason,
    winnerColor,
    timeControl: control,
    initialFen,
    finalFen: chess.fen(),
    pgn: chess.pgn({ maxWidth: 80, newline: "\n" }),
    moves: savedMoves,
    startedAt: startedAt.toISOString(),
    completedAt: completedAt.toISOString()
  };
}
