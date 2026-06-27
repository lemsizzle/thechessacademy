import type { GameReviewSubmission } from "@/lib/types";

export const gameReviewSubmissions: GameReviewSubmission[] = [
  {
    id: "review-submission-001",
    studentId: "stu-001",
    studentName: "Arina",
    gameUrl: "https://lichess.org/mock001",
    requestType: "tactic_review",
    tacticTheme: "Fork",
    moveNumber: 14,
    studentNote: "I think I found a knight fork here.",
    status: "pending_review",
    createdAt: "2026-06-21"
  },
  {
    id: "review-submission-002",
    studentId: "stu-002",
    studentName: "Leo",
    gameUrl: "https://lichess.org/mock002",
    requestType: "analysis_request",
    studentNote: "Please help me understand where I lost the attack.",
    status: "pending_review",
    createdAt: "2026-06-21"
  }
];
