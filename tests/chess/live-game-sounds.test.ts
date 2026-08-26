import { describe, expect, it } from "vitest";
import { captureSquareForUpdate, liveGameSoundForUpdate, type LiveGameSoundSnapshot } from "@/chess/live/liveGameSounds";

function snapshot(status: LiveGameSoundSnapshot["status"], sanMoves: string[]): LiveGameSoundSnapshot {
  return { id: "game-1", status, moves: sanMoves.map((san, index) => ({ san, to: ["e4", "f3", "b5"][index] ?? "e4" })) };
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
    expect(liveGameSoundForUpdate(snapshot("active", ["e4"]), { id: "game-2", status: "active", moves: [{ san: "d4", to: "d4" }] })).toBeNull();
  });

  it("targets capture particles at the new move's destination square", () => {
    expect(captureSquareForUpdate(snapshot("active", ["e4"]), snapshot("active", ["e4", "Nxf3"]))).toBe("f3");
    expect(captureSquareForUpdate(snapshot("active", ["e4"]), snapshot("active", ["e4", "Nf3"]))).toBeNull();
    expect(captureSquareForUpdate(null, snapshot("active", ["e4", "Nxf3"]))).toBeNull();
    expect(captureSquareForUpdate(snapshot("active", ["e4"]), snapshot("active", ["e4", "Nxf3", "Bb5+"]))).toBe("f3");
  });
});
