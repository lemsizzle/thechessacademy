export type BoardAnnotationStyle = "primary" | "secondary" | "warning" | "danger";

export type DrawingModifiers = {
  shiftKey?: boolean;
  ctrlKey?: boolean;
  altKey?: boolean;
  metaKey?: boolean;
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
