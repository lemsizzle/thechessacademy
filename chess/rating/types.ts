export type ChessRatingProfile = {
  studentId: string;
  rating: number;
  peakRating: number;
  ratedGames: number;
  wins: number;
  draws: number;
  losses: number;
  provisional: boolean;
  band: string;
  updatedAt: string;
};

export type ChessRatingLeaderboardEntry = ChessRatingProfile & {
  rank: number;
  name: string;
  classGroup: string;
};

export type MatchmakingTicketStatus = "idle" | "waiting" | "matched" | "cancelled" | "expired";

export type MatchmakingStatus = {
  status: MatchmakingTicketStatus;
  ticketId: string | null;
  gameId: string | null;
  timeControlId: string | null;
  queuedAt: string | null;
};
