import type { ChessColor, PlayerColorChoice } from "@/chess/types";

export function resolvePlayerColor(choice: PlayerColorChoice, random = Math.random): ChessColor {
  if (choice !== "random") return choice;
  return random() < 0.5 ? "white" : "black";
}

export function oppositeColor(color: ChessColor): ChessColor {
  return color === "white" ? "black" : "white";
}

export function chessJsColor(color: ChessColor) {
  return color === "white" ? "w" as const : "b" as const;
}

export function fromChessJsColor(color: "w" | "b"): ChessColor {
  return color === "w" ? "white" : "black";
}
