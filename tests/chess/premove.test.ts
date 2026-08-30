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
