import type { XpEvent } from "@/lib/types";

export const xpEvents: XpEvent[] = [
  { id: "xp-001", studentId: "stu-005", amount: 150, reason: "Completed timed tournament puzzle set", createdAt: "2026-06-18" },
  { id: "xp-002", studentId: "stu-002", amount: 80, reason: "Found a back rank tactic in a live game", createdAt: "2026-06-17" },
  { id: "xp-003", studentId: "stu-001", amount: 55, reason: "Three-class puzzle streak", createdAt: "2026-06-16" },
  { id: "xp-004", studentId: "stu-003", amount: 95, reason: "Won king and pawn endgame drill", createdAt: "2026-06-15" },
  { id: "xp-005", studentId: "stu-004", amount: 40, reason: "Solved first fork set", createdAt: "2026-06-14" }
];
