import type { LichessConnection, LichessSyncLog, PendingAward, StudentLichessAccount } from "@/lib/types";

export const lichessConnections: LichessConnection[] = [
  { studentId: "stu-001", lichessUsername: "arina", connectedAt: "2026-06-18", lastSyncedAt: "2026-06-21", status: "mock" },
  { studentId: "stu-002", lichessUsername: "leo", connectedAt: "2026-06-18", lastSyncedAt: "2026-06-21", status: "mock" },
  { studentId: "stu-005", lichessUsername: "sophia", connectedAt: "2026-06-18", lastSyncedAt: "2026-06-21", status: "mock" }
];

export const studentLichessAccounts: StudentLichessAccount[] = [
  {
    id: "lichess-account-stu-001",
    studentId: "stu-001",
    lichessUserId: "arina",
    lichessUsername: "arina",
    lichessProfileUrl: "https://lichess.org/@/arina",
    blitzRating: 1128,
    blitzGames: 84,
    blitzRatingChange: 12,
    blitzRatingDeviation: 72,
    blitzProvisional: false,
    rapidRating: 1196,
    rapidGames: 41,
    rapidRatingChange: 8,
    rapidRatingDeviation: 84,
    rapidProvisional: false,
    puzzleRating: 1378,
    puzzleGames: 212,
    baselineBlitzGames: 84,
    baselineRapidGames: 41,
    baselinePuzzleGames: 212,
    activityBaselineSetAt: "2026-06-18",
    linkedAt: "2026-06-18",
    lastRatingSyncAt: "2026-06-21",
    lastGameSyncAt: "2026-06-21",
    syncStatus: "mock",
    createdAt: "2026-06-18",
    updatedAt: "2026-06-21"
  },
  {
    id: "lichess-account-stu-002",
    studentId: "stu-002",
    lichessUserId: "leo",
    lichessUsername: "leo",
    lichessProfileUrl: "https://lichess.org/@/leo",
    blitzRating: 1285,
    blitzGames: 126,
    blitzRatingChange: -4,
    blitzRatingDeviation: 63,
    blitzProvisional: false,
    rapidRating: 1341,
    rapidGames: 67,
    rapidRatingChange: 18,
    rapidRatingDeviation: 75,
    rapidProvisional: false,
    puzzleRating: 1512,
    puzzleGames: 304,
    baselineBlitzGames: 126,
    baselineRapidGames: 67,
    baselinePuzzleGames: 304,
    activityBaselineSetAt: "2026-06-18",
    linkedAt: "2026-06-18",
    lastRatingSyncAt: "2026-06-21",
    lastGameSyncAt: "2026-06-21",
    syncStatus: "mock",
    createdAt: "2026-06-18",
    updatedAt: "2026-06-21"
  }
];

export const pendingAwards: PendingAward[] = [
  {
    id: "pending-lichess-stu-001-pin-bronze",
    studentId: "stu-001",
    source: "lichess",
    tacticTheme: "Pin",
    badgeId: "tactic-pin-bronze",
    badgeName: "Pin Bronze",
    xpValue: 10,
    puzzlesSolved: 11,
    status: "pending",
    createdAt: "2026-06-21"
  }
];

export const lichessSyncLogs: LichessSyncLog[] = [
  { id: "lichess-log-001", studentId: "stu-001", level: "info", message: "Mock Lichess puzzle sync found 11 Pin puzzles solved.", createdAt: "2026-06-21" },
  { id: "lichess-log-002", level: "warning", message: "No Lichess OAuth token connected yet. Using mock fallback data.", createdAt: "2026-06-21" }
];
