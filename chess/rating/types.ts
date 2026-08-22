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

export type ChessRatingEvent = {
  id: string;
  eventType: "game" | "admin";
  gameId: string | null;
  opponentId: string | null;
  opponentName: string | null;
  result: "win" | "draw" | "loss" | null;
  ratingBefore: number;
  ratingAfter: number;
  ratingChange: number;
  reason: string;
  createdAt: string;
};

export type ChessRatingLeaderboardEntry = ChessRatingProfile & {
  rank: number;
  name: string;
  classGroup: string;
};

export type ChessRatingDashboard = {
  profile: ChessRatingProfile;
  events: ChessRatingEvent[];
  leaderboard: ChessRatingLeaderboardEntry[];
};

export type MatchmakingTicketStatus = "idle" | "waiting" | "matched" | "cancelled" | "expired";

export type MatchmakingStatus = {
  status: MatchmakingTicketStatus;
  ticketId: string | null;
  gameId: string | null;
  timeControlId: string | null;
  rated: boolean | null;
  queuedAt: string | null;
};
