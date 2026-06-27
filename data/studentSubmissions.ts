import type { StudentGameSubmission, StudentScoreSubmission } from "@/lib/types";

export const studentGameSubmissions: StudentGameSubmission[] = [
  {
    id: "student-game-sub-001",
    studentId: "stu-001",
    gameUrl: "https://lichess.org/abcdefgh",
    platform: "lichess",
    lichessGameId: "abcdefgh",
    playedAs: "white",
    gameType: "Rapid",
    opponentName: "training-rival",
    notes: "I think I found a tactic near the end.",
    status: "pending",
    submittedAt: "2026-06-22"
  }
];

export const studentScoreSubmissions: StudentScoreSubmission[] = [
  {
    id: "student-score-sub-001",
    studentId: "stu-002",
    challengeName: "Fork Challenge",
    tacticTheme: "Fork",
    score: 8,
    totalQuestions: 10,
    timeLimit: "10 minutes",
    platform: "Class puzzle sheet",
    notes: "Missed two hard ones.",
    status: "pending",
    submittedAt: "2026-06-22"
  }
];
