export type BoardAnnotationStyle = "primary" | "secondary" | "warning" | "danger";

export type DrawingModifiers = {
  shiftKey?: boolean;
  ctrlKey?: boolean;
  altKey?: boolean;
  metaKey?: boolean;
};

export type BoardArrow = {
  startSquare: string;
  endSquare: string;
  color: string;
};

export type BoardCircle = {
  square: string;
  color: string;
};

export const BOARD_ANNOTATION_COLORS: Record<BoardAnnotationStyle, string> = {
  primary: "#22c55e",
  secondary: "#38bdf8",
  warning: "#facc15",
  danger: "#f43f5e"
};

// Matches Lichess/Chessground's four drawing brushes:
// plain = green, Shift/Ctrl = red, Alt/Meta = blue, both groups = yellow.
export function annotationStyleForModifiers(modifiers: DrawingModifiers): BoardAnnotationStyle {
  const redModifier = Boolean(modifiers.shiftKey || modifiers.ctrlKey);
  const blueModifier = Boolean(modifiers.altKey || modifiers.metaKey);
  if (redModifier && blueModifier) return "warning";
  if (redModifier) return "danger";
  if (blueModifier) return "secondary";
  return "primary";
}

export function annotationColorForModifiers(modifiers: DrawingModifiers) {
  return BOARD_ANNOTATION_COLORS[annotationStyleForModifiers(modifiers)];
}

export function annotationStyleForColor(color: string): BoardAnnotationStyle {
  return (Object.entries(BOARD_ANNOTATION_COLORS).find(([, value]) => value === color)?.[0] as BoardAnnotationStyle | undefined) ?? "primary";
}

/** Lichess-style shape toggle: repeat a brush to remove it, or recolor it with another brush. */
export function toggleBoardArrow(arrows: readonly BoardArrow[], nextArrow: BoardArrow): BoardArrow[] {
  const matchingIndex = arrows.findIndex((arrow) => (
    arrow.startSquare === nextArrow.startSquare && arrow.endSquare === nextArrow.endSquare
  ));
  if (matchingIndex < 0) return [...arrows, nextArrow];
  if (arrows[matchingIndex].color === nextArrow.color) {
    return arrows.filter((_, index) => index !== matchingIndex);
  }
  return arrows.map((arrow, index) => index === matchingIndex ? nextArrow : arrow);
}

/** Lichess-style circle toggle: repeat a brush to remove it, or recolor it with another brush. */
export function toggleBoardCircle(circles: readonly BoardCircle[], nextCircle: BoardCircle): BoardCircle[] {
  const matchingIndex = circles.findIndex((circle) => circle.square === nextCircle.square);
  if (matchingIndex < 0) return [...circles, nextCircle];
  if (circles[matchingIndex].color === nextCircle.color) {
    return circles.filter((_, index) => index !== matchingIndex);
  }
  return circles.map((circle, index) => index === matchingIndex ? nextCircle : circle);
}

export function shouldClearBoardAnnotations(button: number, clickedInsideBoard: boolean) {
  return button === 0 && !clickedInsideBoard;
}
