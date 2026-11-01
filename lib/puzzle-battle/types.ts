import type {
  PuzzleSessionPuzzle,
  PuzzleMoveInput,
} from "@/lib/puzzle-training/types";
import type {
  StarWarsPuzzle,
  StarWarsMove,
} from "@/lib/puzzle-training/starWars";
import type { HideAndSeekBoard } from "@/lib/puzzle-training/hideAndSeek";
import type { BattleBotLevel } from "./bots";

export const BATTLE_MODES = ["survival", "star-wars", "hide-and-seek"] as const;
export type BattleMode = (typeof BATTLE_MODES)[number];
export const BATTLE_TIMES = [60, 180, 300, 600] as const;
export const BATTLE_LABELS: Record<BattleMode, string> = {
  survival: "Survival",
  "star-wars": "Star Wars",
  "hide-and-seek": "Hide and Seek",
};
export type BattleChallenge =
  | { kind: "survival"; puzzle: PuzzleSessionPuzzle }
  | { kind: "star-wars"; puzzle: StarWarsPuzzle }
  | { kind: "hide-and-seek"; puzzle: HideAndSeekBoard };
export type BattlePlayer = {
  id: string;
  name: string;
  ready: boolean;
  score: number;
  mistakes: number;
  index: number;
  moveIndex: number;
  revision: number;
  done: boolean;
  forfeited: boolean;
  lastAction: string | null;
};
export type BattleState = {
  status: "waiting" | "playing" | "finished" | "cancelled";
  players: BattlePlayer[];
  startsAt: number | null;
  endsAt: number | null;
  winnerId: string | null;
  /** A waiting rematch is reserved for the previous opponent. */
  invitedId?: string;
  rematchId?: string;
  bot?: { level: BattleBotLevel; nextAt: number | null };
};
export type BattleRecord = {
  id: string;
  code: string;
  host_id: string;
  guest_id: string | null;
  mode: BattleMode;
  duration: number;
  version: number;
  state: BattleState;
  created_at: string;
  expires_at: string;
  realtime_token: string;
};
export type BattleAction = {
  type: "join" | "ready" | "leave" | "move" | "finish" | "skip";
  actionId: string;
  revision?: number;
  move?: PuzzleMoveInput;
  moves?: StarWarsMove[];
  squares?: string[];
};
export type PublicChallenge = {
  boardId: string;
  index: number;
  kind: BattleMode;
  fen: string;
  orientation: "white" | "black";
  stars?: string[];
  movableSquares?: string[];
  hiddenPieceTypes?: string[];
  totalSafe?: number;
};
export type BattleView = {
  id: string;
  code: string;
  mode: BattleMode;
  duration: number;
  version: number;
  state: BattleState;
  me: string;
  serverNow: number;
  expiresAt: string;
  topic: string;
  challenge: PublicChallenge | null;
  totalChallenges: number;
};
export type BattleLobbyItem = {
  id: string;
  code: string;
  mode: BattleMode;
  duration: number;
  host: string;
  opponent: string | null;
  status: BattleState["status"];
  mine: boolean;
  winnerId: string | null;
  scores: number[];
  createdAt: string;
};
