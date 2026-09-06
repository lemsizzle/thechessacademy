import { describe, expect, it } from "vitest";
import { Chess } from "chess.js";
import { canPlayPremove, isPremovePromotion, premoveMovesFrom } from "@/chess/live/premove";

describe("live-game premoves", () => {
  it("offers geometric moves for the waiting player's pieces", () => {
    const chess = new Chess();
    chess.move("e4");
    expect(premoveMovesFrom(chess, "g1").map((move) => move.to)).toEqual(expect.arrayContaining(["f3", "h3"]));
  });

  it("allows a pawn capture to be queued before the target arrives", () => {
    const chess = new Chess();
    chess.move("e4");
    expect(premoveMovesFrom(chess, "d2").map((move) => move.to)).toContain("e3");
  });

  it("allows a recapture to be queued before the opponent takes the friendly piece", () => {
    const chess = new Chess("6k1/6b1/8/8/3Q4/2P5/8/6K1 b - - 0 1");
    const recapture = premoveMovesFrom(chess, "c3").find((move) => move.to === "d4");
    expect(recapture).toMatchObject({ from: "c3", to: "d4", piece: "p", potentialCapture: true });

    chess.move({ from: "g7", to: "d4" });
    expect(canPlayPremove(chess.fen(), { from: "c3", to: "d4" })).toBe(true);
  });

  it("revalidates a queued move against the confirmed reply", () => {
    const chess = new Chess();
    chess.move("e4");
    chess.move("e5");
    expect(canPlayPremove(chess.fen(), { from: "g1", to: "f3" })).toBe(true);
    expect(canPlayPremove(chess.fen(), { from: "e4", to: "e5" })).toBe(false);
  });

  it("recognizes queued promotions", () => {
    const chess = new Chess("8/P7/8/8/8/8/7p/4k2K b - - 0 1");
    expect(isPremovePromotion(chess, "white", "a7", "a8")).toBe(true);
  });
});
