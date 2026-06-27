import type { ActivityEvent } from "@/lib/types";

export const activity: ActivityEvent[] = [
  { id: "act-001", title: "Badge awarded", detail: "Sophia earned Tournament Warrior.", createdAt: "2026-06-18" },
  { id: "act-002", title: "XP added", detail: "Leo gained 80 XP for a back rank tactic.", createdAt: "2026-06-17" },
  { id: "act-003", title: "Quest updated", detail: "Fork Finder moved to in-progress.", createdAt: "2026-06-16" },
  { id: "act-004", title: "Student added", detail: "Noah joined Monday Pawns.", createdAt: "2026-06-13" }
];
