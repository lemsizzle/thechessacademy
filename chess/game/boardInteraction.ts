import type { Chess, Square } from "chess.js";

export type BoardClickAction<Square extends string = string> =
  | { type: "deselect" }
  | { type: "move"; from: Square; to: Square }
  | { type: "select"; square: Square }
  | { type: "illegal"; from: Square; to: Square }
  | { type: "clear" };

export function boardClickAction<Square extends string>({
  selectedSquare,
  clickedSquare,
  legalDestination,
  selectable,
  reportIllegal = false
}: {
  selectedSquare: Square | null;
  clickedSquare: Square;
  legalDestination: boolean;
  selectable: boolean;
  reportIllegal?: boolean;
}): BoardClickAction<Square> {
  if (selectedSquare === clickedSquare) return { type: "deselect" };
  if (selectedSquare && legalDestination) return { type: "move", from: selectedSquare, to: clickedSquare };
  if (selectable) return { type: "select", square: clickedSquare };
  if (selectedSquare && reportIllegal) return { type: "illegal", from: selectedSquare, to: clickedSquare };
  return { type: "clear" };
}
/** Keep an anticipated move selected when the opponent replies, not on resets/undo. */
export function retainedBoardSelection(previous: Chess, next: Chess, selected: string | null, human: "w" | "b") {
  if (!selected || previous.turn() === human || next.turn() !== human) return null;
  const ply = (position: Chess) => Number(position.fen().split(" ")[5]) * 2 + (position.turn() === "b" ? 1 : 0);
  if (ply(next) !== ply(previous) + 1) return null;
  const before = previous.get(selected as Square);
  const after = next.get(selected as Square);
  return before?.color === human && after?.color === human && before.type === after.type ? selected : null;
}
