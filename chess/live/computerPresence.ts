import { BOT_DIFFICULTIES } from "@/chess/bots/difficulties";
import { TIME_CONTROLS } from "@/chess/game/timeControls";
import type { ChessColor, GameResultReason } from "@/chess/types";

export const COMPUTER_GAME_PREFIX = "computer-";
export const COMPUTER_PRESENCE_HEARTBEAT_MS = 45_000;
export const COMPUTER_PRESENCE_TTL_MS = 120_000;
export const COMPUTER_PRESENCE_THROTTLE_MS = 1_000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const UCI = /^[a-h][1-8][a-h][1-8][qrbn]?$/;
const REASONS = new Set<GameResultReason>(["checkmate", "stalemate", "resignation", "timeout", "threefold_repetition", "fifty_move_rule", "insufficient_material", "draw"]);

export type ComputerPresenceInput = {
  gameId: string;
  version: number;
  startedAt: string;
  status: "active" | "completed" | "closed";
  botId: string;
  humanColor: ChessColor;
  timeControlId: string;
  moves: string[];
  clock: { whiteMs: number; blackMs: number } | null;
  capturedAt: string;
  winnerColor: ChessColor | null;
  resultReason: GameResultReason | null;
};

export class ComputerPresenceError extends Error {
  constructor(message: string, readonly status = 400) { super(message); }
}

export function computerGameId(value: string) {
  const id = value.slice(COMPUTER_GAME_PREFIX.length);
  if (!value.startsWith(COMPUTER_GAME_PREFIX) || !UUID.test(id)) throw new ComputerPresenceError("Invalid computer game ID.");
  return id;
}

export function parseComputerPresence(value: unknown, now = Date.now()): ComputerPresenceInput {
  const input = value as Partial<ComputerPresenceInput> | null;
  const invalid = () => { throw new ComputerPresenceError("Invalid computer game snapshot."); };
  if (!input || typeof input !== "object" || typeof input.gameId !== "string" || !UUID.test(input.gameId)) return invalid();
  if (!Number.isInteger(input.version) || input.version! < 1 || input.version! > 2_147_483_647) return invalid();
  if (!["active", "completed", "closed"].includes(input.status ?? "")) return invalid();
  if (input.humanColor !== "white" && input.humanColor !== "black") return invalid();
  if (!BOT_DIFFICULTIES.some((bot) => bot.id === input.botId)) return invalid();
  const control = TIME_CONTROLS.find((control) => control.id === input.timeControlId);
  if (!control || !Array.isArray(input.moves) || input.moves.length > 1_200 || input.moves.some((move) => typeof move !== "string" || !UCI.test(move))) return invalid();
  const started = typeof input.startedAt === "string" ? Date.parse(input.startedAt) : NaN;
  const captured = typeof input.capturedAt === "string" ? Date.parse(input.capturedAt) : NaN;
  if (!Number.isFinite(started) || started > now + 60_000 || !Number.isFinite(captured) || captured < started - 60_000 || Math.abs(now - captured) > COMPUTER_PRESENCE_TTL_MS) return invalid();
  if (control.initialMs === null) {
    if (input.clock !== null) return invalid();
  } else {
    const limit = control.initialMs + Math.ceil(input.moves.length / 2) * control.incrementMs;
    if (!input.clock || [input.clock.whiteMs, input.clock.blackMs].some((ms) => !Number.isFinite(ms) || ms < 0 || ms > limit)) return invalid();
  }
  if (input.winnerColor !== null && input.winnerColor !== "white" && input.winnerColor !== "black") return invalid();
  if (input.status === "completed") {
    if (!REASONS.has(input.resultReason!)) return invalid();
  } else if (input.resultReason !== null || input.winnerColor !== null) return invalid();
  return {
    gameId: input.gameId, version: input.version!, startedAt: new Date(started).toISOString(),
    status: input.status as ComputerPresenceInput["status"], botId: input.botId!, humanColor: input.humanColor,
    timeControlId: control.id, moves: input.moves, clock: input.clock!, capturedAt: new Date(captured).toISOString(),
    winnerColor: input.winnerColor, resultReason: input.resultReason!
  };
}
