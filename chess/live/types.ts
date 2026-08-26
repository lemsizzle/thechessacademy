import type { ChessColor, GameMove, GameResultReason, TimeControl } from "@/chess/types";
import type { AvatarItem, StudentAvatarConfig } from "@/lib/types";

export type LiveGameStatus = "waiting" | "active" | "completed" | "cancelled";

export type LiveGamePlayer = {
  id: string;
  name: string;
  avatar?: StudentAvatarConfig;
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
  arena_tournament_id: string | null;
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
  avatarItems: AvatarItem[];
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
  arenaTournamentId: string | null;
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
  arenaTournamentId: string | null;
  updatedAt: string;
};

export type TeacherLiveGameSummary = {
  id: string;
  players: Record<ChessColor, LiveGamePlayer>;
  timeControl: TimeControl;
  activeColor: ChessColor;
  moveCount: number;
  rated: boolean;
  matchmaking: boolean;
  arenaTournamentId: string | null;
  startedAt: string;
  updatedAt: string;
};

export type TeacherLiveGameSnapshot = {
  id: string;
  status: LiveGameStatus;
  version: number;
  realtimeTopic: string;
  players: Record<ChessColor, LiveGamePlayer>;
  avatarItems: AvatarItem[];
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
  winnerColor: ChessColor | null;
  resultReason: GameResultReason | null;
  startedAt: string;
  completedAt: string | null;
  rated: boolean;
  matchmaking: boolean;
  arenaTournamentId: string | null;
  updatedAt: string;
  serverNow: string;
};

export type LiveMoveInput = {
  from: string;
  to: string;
  promotion?: "q" | "r" | "b" | "n";
  version: number;
};

export type LiveGameAction = "cancel" | "resign" | "offer_draw" | "accept_draw" | "decline_draw" | "claim_timeout";
