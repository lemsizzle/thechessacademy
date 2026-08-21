export type PerformanceStudentInput = {
  id: string;
  name: string;
  slug: string;
  classGroup: string;
};

export type PerformanceGameInput = {
  id: string;
  playerId: string;
  opponentType: "computer" | "student";
  result: "win" | "draw" | "loss";
  completedAt: string;
  sourceLiveGameId: string | null;
};

export type StudentChessPerformance = PerformanceStudentInput & {
  total: number;
  wins: number;
  draws: number;
  losses: number;
  winRate: number;
  computerGames: number;
  liveGames: number;
  lastPlayedAt: string | null;
  latestGameId: string | null;
  latestResult: PerformanceGameInput["result"] | null;
};

export type AdminChessPerformanceReport = {
  classes: string[];
  selectedClass: string;
  summary: {
    students: number;
    activePlayers: number;
    totalGames: number;
    computerGames: number;
    liveGames: number;
    gamesLast30Days: number;
  };
  students: StudentChessPerformance[];
};
