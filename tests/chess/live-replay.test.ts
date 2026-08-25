import { describe, expect, it } from "vitest";
import type { GameMove } from "@/chess/types";
import { replayFenAtPly, stepReplayPly } from "@/chess/live/replay";

const moves = [
  { ply: 1, color: "white", san: "e4", from: "e2", to: "e4", fenAfter: "fen-after-e4" },
  { ply: 2, color: "black", san: "e5", from: "e7", to: "e5", fenAfter: "fen-after-e5" }
] satisfies GameMove[];

describe("spectator move replay", () => {
  it("uses the starting position at ply zero and each move's saved position afterward", () => {
    expect(replayFenAtPly("initial-fen", moves, 0)).toBe("initial-fen");
    expect(replayFenAtPly("initial-fen", moves, 1)).toBe("fen-after-e4");
    expect(replayFenAtPly("initial-fen", moves, 2)).toBe("fen-after-e5");
  });

  it("steps backward from live and returns to live at the newest move", () => {
    expect(stepReplayPly(null, -1, 2)).toBe(1);
    expect(stepReplayPly(1, 1, 2)).toBeNull();
  });

  it("stops at the start and current position", () => {
    expect(stepReplayPly(0, -1, 2)).toBe(0);
    expect(stepReplayPly(null, 1, 2)).toBeNull();
  });
});
