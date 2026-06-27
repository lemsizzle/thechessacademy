import type { ArenaTournamentResult, PendingTournamentAward } from "@/lib/types";

const importedAt = new Date().toISOString();
const tournamentStartsAt = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();

export const mockArenaTournamentResults: ArenaTournamentResult[] = [
  {
    id: "arena-result-mock-arena-finished-arina",
    tournamentId: "lichess-arena-mock-arena-finished",
    lichessTournamentId: "mock-arena-finished",
    studentId: "stu-001",
    lichessUsername: "arina",
    rank: 2,
    score: 24,
    rating: 1196,
    performance: 1370,
    matched: true,
    tournamentStartsAt,
    importedAt
  },
  {
    id: "arena-result-mock-arena-finished-leo",
    tournamentId: "lichess-arena-mock-arena-finished",
    lichessTournamentId: "mock-arena-finished",
    studentId: "stu-002",
    lichessUsername: "leo",
    rank: 6,
    score: 17,
    rating: 1341,
    performance: 1412,
    matched: true,
    tournamentStartsAt,
    importedAt
  },
  {
    id: "arena-result-mock-arena-finished-guest-player",
    tournamentId: "lichess-arena-mock-arena-finished",
    lichessTournamentId: "mock-arena-finished",
    lichessUsername: "guest-player",
    rank: 9,
    score: 12,
    matched: false,
    tournamentStartsAt,
    importedAt
  }
];

export const mockPendingTournamentAwards: PendingTournamentAward[] = [
  {
    id: "tournament-award-mock-arena-finished-stu-001",
    studentId: "stu-001",
    tournamentId: "lichess-arena-mock-arena-finished",
    lichessTournamentId: "mock-arena-finished",
    lichessUsername: "arina",
    title: "Chess Academy Friday Arena",
    description: "Arena participation, 24 points, and a top 3 finish.",
    xpAmount: 195,
    reason: "25 participation + 120 score XP + 50 top 3 bonus",
    tournamentSource: "team_sync",
    status: "pending",
    createdAt: importedAt
  }
];
