import type { ChessColor, GameMove, GameResultReason, TimeControl } from "@/chess/types";

export type LiveGameStatus = "waiting" | "active" | "completed" | "cancelled";

export type LiveGamePlayer = {
  id: string;
  name: string;
};

export type LiveGameRecord = {
  id: string;
  challenge_code: string;
  realtime_token: string;
  created_by: string;
  white_player_id: string | null;
  black_player_id: string | null;
  status: LiveGameStatus;
  time_control_id: string;
  time_control: TimeControl;
  initial_fen: string;
  current_fen: string;
  moves: GameMove[];
  version: number;
  active_color: ChessColor;
  white_ms: number | null;
  black_ms: number | null;
  clock_started_at: string | null;
  draw_offered_by: string | null;
  winner_color: ChessColor | null;
  result_reason: GameResultReason | null;
  pgn: string;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  rated: boolean;
  matchmaking: boolean;
  rating_applied_at: string | null;
  rematch_requested_by: string | null;
  rematch_game_id: string | null;
  rematch_of_game_id: string | null;
};

export type LiveGameSnapshot = {
  id: string;
  challengeCode: string;
  status: LiveGameStatus;
  version: number;
  realtimeTopic: string;
  viewer: { id: string; color: ChessColor };
  players: Record<ChessColor, LiveGamePlayer | null>;
  timeControl: TimeControl;
  initialFen: string;
  fen: string;
  moves: GameMove[];
  activeColor: ChessColor;
  clocks: {
    whiteMs: number | null;
    blackMs: number | null;
    startedAt: string | null;
  };
  drawOfferedBy: string | null;
  winnerColor: ChessColor | null;
  resultReason: GameResultReason | null;
  startedAt: string | null;
  completedAt: string | null;
  matchmaking: boolean;
  rematchRequestedBy: string | null;
  rematchGameId: string | null;
  rematchOfGameId: string | null;
  serverNow: string;
};

export type LiveGameSummary = {
  id: string;
  challengeCode: string;
  status: LiveGameStatus;
  viewerColor: ChessColor;
  opponent: LiveGamePlayer | null;
  timeControl: TimeControl;
  activeColor: ChessColor;
  winnerColor: ChessColor | null;
  resultReason: GameResultReason | null;
  matchmaking: boolean;
  updatedAt: string;
};

export type LiveMoveInput = {
  from: string;
  to: string;
  promotion?: "q" | "r" | "b" | "n";
  version: number;
};

export type LiveGameAction = "cancel" | "resign" | "offer_draw" | "accept_draw" | "decline_draw" | "claim_timeout";
