import { describe, expect, it } from "vitest";
import { boardSquaresForOrientation, describeBoardSquare, nextBoardSquare } from "@/chess/components/boardAccessibility";

describe("accessible chessboard navigation", () => {
  it("orders squares to match the visible board orientation", () => {
    const white = boardSquaresForOrientation("white");
    const black = boardSquaresForOrientation("black");
    expect([white[0], white[7], white[56], white[63]]).toEqual(["a8", "h8", "a1", "h1"]);
    expect([black[0], black[7], black[56], black[63]]).toEqual(["h1", "a1", "h8", "a8"]);
  });

  it("moves through the visual grid without leaving its edges", () => {
    const squares = boardSquaresForOrientation("white");
    expect(nextBoardSquare(squares, "e4", "ArrowUp")).toBe("e5");
    expect(nextBoardSquare(squares, "e4", "ArrowLeft")).toBe("d4");
    expect(nextBoardSquare(squares, "a4", "ArrowLeft")).toBe("a4");
    expect(nextBoardSquare(squares, "e4", "Home")).toBe("a4");
    expect(nextBoardSquare(squares, "e4", "End")).toBe("h4");
  });

  it("gives each square a meaningful piece and interaction label", () => {
    expect(describeBoardSquare({
      square: "e4",
      piece: { color: "w", type: "n" },
      selected: true,
      inCheck: true,
      lastMove: "end"
    })).toBe("e4, white knight, selected, in check, last move ended here");

    expect(describeBoardSquare({
      square: "f6",
      piece: { color: "b", type: "q" },
      legalDestination: true,
      legalCapture: true
    })).toBe("f6, black queen, legal capture");
  });
});
