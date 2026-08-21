export const CHESS_HISTORY_MODES = ["all", "computer", "student"] as const;
export const CHESS_HISTORY_RESULTS = ["all", "win", "draw", "loss"] as const;

export type ChessHistoryMode = (typeof CHESS_HISTORY_MODES)[number];
export type ChessHistoryResult = (typeof CHESS_HISTORY_RESULTS)[number];

export type ChessHistoryFilters = {
  mode: ChessHistoryMode;
  result: ChessHistoryResult;
  page: number;
  pageSize: number;
};

export type ChessHistoryGame = {
  id: string;
  opponentType: Exclude<ChessHistoryMode, "all">;
  opponentName: string;
  playerColor: "white" | "black";
  result: Exclude<ChessHistoryResult, "all">;
  resultReason: string;
  moveCount: number;
  startedAt: string;
  completedAt: string;
  timeControl: {
    name?: string;
    initialSeconds?: number;
    incrementSeconds?: number;
  };
};

export type ChessHistorySummary = {
  total: number;
  wins: number;
  draws: number;
  losses: number;
  winRate: number;
  computerGames: number;
  liveGames: number;
};

export type ChessHistoryPage = {
  games: ChessHistoryGame[];
  filters: ChessHistoryFilters;
  summary: ChessHistorySummary;
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
};
