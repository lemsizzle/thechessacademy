import { describe, expect, it } from "vitest";
import { isCurrentLiveSnapshot, liveBoardInput } from "@/chess/live/boardInput";

const game = { status: "active" as const, activeColor: "white" as const, viewer: { id: "student", color: "white" as const } };

describe("fast live board input", () => {
  it("allows a next premove while a move request is still pending", () => {
    expect(liveBoardInput(game, true, true, false)).toEqual({ canQueuePremove: true, interactive: true });
    expect(liveBoardInput({ ...game, activeColor: "black" }, true, true, false)).toEqual({ canQueuePremove: true, interactive: true });
  });
  it("keeps actions, correspondence waits, and finished games locked", () => {
    for (const result of [liveBoardInput(game, true, false, false), liveBoardInput(game, true, true, true), liveBoardInput({ ...game, status: "completed" }, false, false, false)]) {
      expect(result).toEqual({ canQueuePremove: false, interactive: false });
    }
  });
  it("allows normal moves and opponent-turn premoves", () => {
    expect(liveBoardInput(game, false, false, false)).toEqual({ canQueuePremove: false, interactive: true });
    expect(liveBoardInput({ ...game, activeColor: "black" }, false, false, false)).toEqual({ canQueuePremove: true, interactive: true });
  });
  it("rejects stale polling and delayed acknowledgements without rejecting a new game", () => {
    const current = { id: "game", version: 4, serverNow: "2026-09-07T00:00:02Z" };
    expect(isCurrentLiveSnapshot(current, { ...current, version: 3, serverNow: "2026-09-07T00:00:03Z" })).toBe(false);
    expect(isCurrentLiveSnapshot(current, { ...current, serverNow: "2026-09-07T00:00:01Z" })).toBe(false);
    expect(isCurrentLiveSnapshot(current, { ...current, version: 5 })).toBe(true);
    expect(isCurrentLiveSnapshot(current, { ...current, id: "other", version: 1 })).toBe(true);
  });
});
