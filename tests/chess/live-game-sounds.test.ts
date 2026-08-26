import { describe, expect, it } from "vitest";
import { liveGameSoundForUpdate, type LiveGameSoundSnapshot } from "@/chess/live/liveGameSounds";

function snapshot(status: LiveGameSoundSnapshot["status"], sanMoves: string[]): LiveGameSoundSnapshot {
  return { id: "game-1", status, moves: sanMoves.map((san) => ({ san })) };
}

describe("liveGameSoundForUpdate", () => {
  it("does not replay historical sounds when a live game opens", () => {
    expect(liveGameSoundForUpdate(null, snapshot("active", ["e4", "e5"]))).toBeNull();
  });

  it("selects move, capture, and check sounds for new moves", () => {
    expect(liveGameSoundForUpdate(snapshot("active", []), snapshot("active", ["e4"]))).toBe("move");
    expect(liveGameSoundForUpdate(snapshot("active", ["e4"]), snapshot("active", ["e4", "Nxf3"]))).toBe("capture");
    expect(liveGameSoundForUpdate(snapshot("active", ["e4", "Nxf3"]), snapshot("active", ["e4", "Nxf3", "Bb5+"]))).toBe("check");
  });

  it("uses the special end sound once when the game completes", () => {
    expect(liveGameSoundForUpdate(snapshot("active", ["e4"]), snapshot("completed", ["e4"]))).toBe("end");
    expect(liveGameSoundForUpdate(snapshot("completed", ["e4"]), snapshot("completed", ["e4"]))).toBeNull();
  });

  it("does not carry sound state between games", () => {
    expect(liveGameSoundForUpdate(snapshot("active", ["e4"]), { id: "game-2", status: "active", moves: [{ san: "d4" }] })).toBeNull();
  });
});
