import { describe, expect, it } from "vitest";
import { boardClickAction } from "@/chess/game/boardInteraction";

describe("board click interactions", () => {
  it("deselects when the selected piece is clicked again", () => {
    expect(boardClickAction({
      selectedSquare: "e2",
      clickedSquare: "e2",
      legalDestination: false,
      selectable: true
    })).toEqual({ type: "deselect" });
  });

  it("moves to a legal destination", () => {
    expect(boardClickAction({
      selectedSquare: "e2",
      clickedSquare: "e4",
      legalDestination: true,
      selectable: false
    })).toEqual({ type: "move", from: "e2", to: "e4" });
  });

  it("switches to another friendly piece before reporting an illegal move", () => {
    expect(boardClickAction({
      selectedSquare: "e2",
      clickedSquare: "g1",
      legalDestination: false,
      selectable: true,
      reportIllegal: true
    })).toEqual({ type: "select", square: "g1" });
  });

  it("reports an illegal destination only when requested", () => {
    expect(boardClickAction({
      selectedSquare: "e2",
      clickedSquare: "e5",
      legalDestination: false,
      selectable: false,
      reportIllegal: true
    })).toEqual({ type: "illegal", from: "e2", to: "e5" });
  });
});
