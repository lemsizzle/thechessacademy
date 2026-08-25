import { describe, expect, it } from "vitest";
import { materialAdvantageForColor, whiteMaterialAdvantage } from "@/chess/game/material";

describe("live material advantage", () => {
  it("starts even", () => {
    expect(whiteMaterialAdvantage("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1")).toBe(0);
  });

  it("calculates the signed balance from the board", () => {
    const whiteUpAQueenForARook = whiteMaterialAdvantage("r3k3/8/8/8/8/8/8/3QK3 w - - 0 1");
    expect(whiteUpAQueenForARook).toBe(4);
    expect(materialAdvantageForColor(whiteUpAQueenForARook, "white")).toBe(4);
    expect(materialAdvantageForColor(whiteUpAQueenForARook, "black")).toBe(-4);
  });
});
