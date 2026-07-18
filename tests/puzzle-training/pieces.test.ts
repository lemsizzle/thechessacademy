import { defaultPieces } from "react-chessboard";
import { describe, expect, it } from "vitest";

describe("production chess piece set", () => {
  it("provides all twelve SVG-rendered piece types", () => {
    expect(Object.keys(defaultPieces).sort()).toEqual([
      "bB", "bK", "bN", "bP", "bQ", "bR",
      "wB", "wK", "wN", "wP", "wQ", "wR"
    ]);
    expect(Object.values(defaultPieces).every((piece) => typeof piece === "function")).toBe(true);
  });
});
