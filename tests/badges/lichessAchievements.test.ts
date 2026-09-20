import { describe, expect, it } from "vitest";
import { lichessAchievementInput } from "@/lib/badges/gameAchievements/lichess";
import type { RawLichessGame } from "@/lib/lichess/fetchStudentGamesForWindow";

const game: RawLichessGame = {
  id: "abcd1234", createdAt: 1000, lastMoveAt: 2000, status: "mate", variant: "standard",
  moves: "f3 e5 g4 Qh4#", winner: "black", players: { white: { user: { id: "learner" } }, black: { user: { id: "opponent" } } },
  clocks: [100, 90, 80, 10], clock: { increment: 0 }
};
describe("Lichess achievement eligibility", () => {
  it("maps the linked side and centisecond clocks", () => {
    expect(lichessAchievementInput(game, " Learner ")).toMatchObject({ color: "w", winner: "b", reason: "checkmate", clocksMs: [1000, 900, 800, 100], incrementMs: 0 });
    expect(lichessAchievementInput(game, "OPPONENT")?.color).toBe("b");
  });
  it("does not mistake abandonment for a clock win", () => {
    expect(lichessAchievementInput({ ...game, status: "timeout" }, "learner")?.reason).toBe("abandonment");
    expect(lichessAchievementInput({ ...game, status: "outoftime" }, "learner")?.reason).toBe("timeout");
  });
  it.each([
    { variant: "chess960" }, { initialFen: "7k/8/8/8/8/8/8/K7 w - - 0 1" },
    { status: "started" }, { status: "aborted" }, { id: "invalid" }, { moves: "" },
    { lastMoveAt: 0 }, { createdAt: Number.NaN }
  ])("rejects ineligible games: %j", (override) => {
    expect(lichessAchievementInput({ ...game, ...override }, "learner")).toBeNull();
  });
  it("rejects games belonging to another account", () => {
    expect(lichessAchievementInput(game, "someone-else")).toBeNull();
  });
  it("never invents unavailable clocks", () => {
    expect(lichessAchievementInput({ ...game, clocks: undefined, clock: undefined }, "learner")).toMatchObject({ clocksMs: undefined, incrementMs: undefined });
    expect(lichessAchievementInput({ ...game, clocks: [-1, NaN, 0] }, "learner")?.clocksMs).toEqual([null, null, 0]);
  });
});
