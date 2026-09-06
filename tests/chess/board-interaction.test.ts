import { describe, expect, it } from "vitest";
import { Chess } from "chess.js";
import { boardClickAction, retainedBoardSelection } from "@/chess/game/boardInteraction";

describe("board click interactions", () => {
  it("retains a white piece selected while Black is moving", () => {
    const previous = new Chess(); previous.move("e4");
    const next = new Chess(previous.fen()); next.move("e5");
    expect(retainedBoardSelection(previous, next, "g1", "w")).toBe("g1");
  });

  it("retains a black piece selected while White is moving", () => {
    const previous = new Chess();
    const next = new Chess(); next.move("e4");
    expect(retainedBoardSelection(previous, next, "g8", "b")).toBe("g8");
  });

  it("clears a captured piece, own move, or rewind instead of retaining invalid selection", () => {
    const previous = new Chess(); previous.move("e4"); previous.move("d5"); previous.move("Nc3");
    const next = new Chess(previous.fen()); next.move("dxe4");
    expect(retainedBoardSelection(previous, next, "e4", "w")).toBeNull();
    expect(retainedBoardSelection(next, previous, "c3", "w")).toBeNull();
    const start = new Chess(); const after = new Chess(); after.move("e4");
    expect(retainedBoardSelection(start, after, "g1", "w")).toBeNull();
  });

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
