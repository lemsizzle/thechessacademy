import { describe, expect, it } from "vitest";
import { arenaPoints, currentArenaStatus, rankArenaStandings } from "@/chess/arena/scoring";
import type { InternalArenaStanding } from "@/chess/arena/types";

function standing(patch: Partial<InternalArenaStanding>): Omit<InternalArenaStanding, "rank"> {
  return {
    studentId: "student",
    name: "Student",
    status: "waiting",
    score: 0,
    gamesPlayed: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    currentGameId: null,
    ...patch
  };
}

describe("internal Arena rules", () => {
  it("uses simple classroom Arena scoring", () => {
    expect(arenaPoints("win")).toBe(2);
    expect(arenaPoints("draw")).toBe(1);
    expect(arenaPoints("loss")).toBe(0);
  });

  it("moves scheduled Arenas through active and finished time states", () => {
    const startsAt = "2026-08-26T10:00:00.000Z";
    const endsAt = "2026-08-26T11:00:00.000Z";
    expect(currentArenaStatus("scheduled", startsAt, endsAt, Date.parse("2026-08-26T09:59:00Z"))).toBe("scheduled");
    expect(currentArenaStatus("scheduled", startsAt, endsAt, Date.parse("2026-08-26T10:30:00Z"))).toBe("active");
    expect(currentArenaStatus("active", startsAt, endsAt, Date.parse("2026-08-26T11:00:00Z"))).toBe("finished");
    expect(currentArenaStatus("cancelled", startsAt, endsAt, Date.parse("2026-08-26T10:30:00Z"))).toBe("cancelled");
  });

  it("ranks by points, wins, games, and name while hiding withdrawn entries", () => {
    const ranked = rankArenaStandings([
      standing({ studentId: "b", name: "Bravo", score: 4, wins: 2, gamesPlayed: 3, losses: 1 }),
      standing({ studentId: "a", name: "Alpha", score: 4, wins: 2, gamesPlayed: 2, draws: 0 }),
      standing({ studentId: "c", name: "Charlie", score: 8, status: "withdrawn" })
    ]);
    expect(ranked.map((entry) => entry.name)).toEqual(["Alpha", "Bravo"]);
    expect(ranked.map((entry) => entry.rank)).toEqual([1, 2]);
  });
});
