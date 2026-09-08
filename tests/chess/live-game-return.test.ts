import { describe, expect, it } from "vitest";
import { resumableLiveGames } from "@/components/student/ActiveLiveGameBanner";
import type { LiveGameSummary } from "@/chess/live/types";

const game = (overrides: Partial<LiveGameSummary> = {}) => ({
  id: "saved-game", status: "active", gameMode: "live", ...overrides
} as LiveGameSummary);

describe("return to a saved live game", () => {
  it("offers active games on the dashboard, lobby and other student pages", () => {
    for (const path of ["/student", "/student/play/live", "/student/training"]) {
      expect(resumableLiveGames([game()], path)).toHaveLength(1);
    }
  });
  it("includes tournament games", () => {
    expect(resumableLiveGames([game({ arenaTournamentId: "arena" })], "/student")).toHaveLength(1);
  });
  it("does not offer finished, cancelled, waiting or correspondence games", () => {
    expect(resumableLiveGames([
      game({ status: "completed" }), game({ status: "cancelled" }),
      game({ status: "waiting" }), game({ gameMode: "correspondence" })
    ], "/student")).toEqual([]);
  });
  it("hides the game already being viewed, including a trailing slash", () => {
    for (const path of ["/student/play/live/saved-game", "/student/play/live/saved-game/"]) {
      expect(resumableLiveGames([game()], path)).toEqual([]);
    }
  });
  it("keeps any other active game reachable", () => {
    expect(resumableLiveGames([game(), game({ id: "other" })], "/student/play/live/saved-game").map(g => g.id)).toEqual(["other"]);
  });
});
