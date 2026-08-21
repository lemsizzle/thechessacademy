import { describe, expect, it } from "vitest";
import { buildAdminChessPerformance } from "@/chess/performance/aggregate";
import type { PerformanceGameInput, PerformanceStudentInput } from "@/chess/performance/types";

const students: PerformanceStudentInput[] = [
  { id: "student-a", name: "Avery", slug: "avery", classGroup: "Knights" },
  { id: "student-b", name: "Blake", slug: "blake", classGroup: "Knights" },
  { id: "student-c", name: "Casey", slug: "casey", classGroup: "Bishops" }
];

const games: PerformanceGameInput[] = [
  { id: "computer-a", playerId: "student-a", opponentType: "computer", result: "win", completedAt: "2026-08-20T12:00:00.000Z", sourceLiveGameId: null },
  { id: "live-a", playerId: "student-a", opponentType: "student", result: "loss", completedAt: "2026-08-19T12:00:00.000Z", sourceLiveGameId: "shared-live-game" },
  { id: "live-b", playerId: "student-b", opponentType: "student", result: "win", completedAt: "2026-08-19T12:00:00.000Z", sourceLiveGameId: "shared-live-game" },
  { id: "computer-b", playerId: "student-b", opponentType: "computer", result: "draw", completedAt: "2026-07-01T12:00:00.000Z", sourceLiveGameId: null },
  { id: "computer-c", playerId: "student-c", opponentType: "computer", result: "loss", completedAt: "2026-08-21T12:00:00.000Z", sourceLiveGameId: null }
];

describe("admin chess performance", () => {
  it("deduplicates the two player records created by one live game", () => {
    const report = buildAdminChessPerformance(students, games, "all", new Date("2026-08-22T12:00:00.000Z"));
    expect(report.summary).toEqual({
      students: 3,
      activePlayers: 3,
      totalGames: 4,
      computerGames: 3,
      liveGames: 1,
      gamesLast30Days: 3
    });
  });

  it("filters the roster and totals by class without losing per-student records", () => {
    const report = buildAdminChessPerformance(students, games, "Knights", new Date("2026-08-22T12:00:00.000Z"));
    expect(report.selectedClass).toBe("Knights");
    expect(report.summary).toMatchObject({ students: 2, activePlayers: 2, totalGames: 3, computerGames: 2, liveGames: 1 });
    expect(report.students.map((student) => student.name)).toEqual(["Avery", "Blake"]);
    expect(report.students[0]).toMatchObject({ total: 2, wins: 1, draws: 0, losses: 1, winRate: 50, latestGameId: "computer-a" });
    expect(report.students[1]).toMatchObject({ total: 2, wins: 1, draws: 1, losses: 0, winRate: 50, latestGameId: "live-b" });
  });

  it("keeps students without games and places them after recent players", () => {
    const report = buildAdminChessPerformance(students, games.filter((game) => game.playerId === "student-a"));
    expect(report.students.map((student) => student.name)).toEqual(["Avery", "Blake", "Casey"]);
    expect(report.students[1]).toMatchObject({ total: 0, winRate: 0, lastPlayedAt: null });
  });

  it("falls back to all classes for an unknown class filter", () => {
    const report = buildAdminChessPerformance(students, games, "Queens");
    expect(report.selectedClass).toBe("all");
    expect(report.students).toHaveLength(3);
    expect(report.classes).toEqual(["Bishops", "Knights"]);
  });
});
