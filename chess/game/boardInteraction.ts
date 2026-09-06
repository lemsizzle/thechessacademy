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
