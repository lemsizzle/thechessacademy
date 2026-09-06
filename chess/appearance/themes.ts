import type { CSSProperties } from "react";

export const PAPER_CHESS_SET_SLUG = "paper-chess-set";
export type ChessTheme = "academy" | "paper";
export type BoardAppearance = { boardTheme: ChessTheme; pieceTheme: ChessTheme };
export const DEFAULT_BOARD_APPEARANCE: BoardAppearance = { boardTheme: "academy", pieceTheme: "academy" };

export function appearanceStorageKey(studentId: string) {
  return `academy-board-appearance:v1:${studentId}`;
}

export function parseBoardAppearance(raw: string | null): BoardAppearance {
  try {
    const value: unknown = JSON.parse(raw ?? "null");
    if (!value || typeof value !== "object") return DEFAULT_BOARD_APPEARANCE;
    const preferences = value as Record<string, unknown>;
    return {
      boardTheme: preferences.boardTheme === "paper" ? "paper" : "academy",
      pieceTheme: preferences.pieceTheme === "paper" ? "paper" : "academy"
    };
  } catch { return DEFAULT_BOARD_APPEARANCE; }
}

export function unlockedAppearance(preferences: BoardAppearance, ownsPaper: boolean): BoardAppearance {
  return ownsPaper ? preferences : DEFAULT_BOARD_APPEARANCE;
}

// CSS-only fibres: no large textures, image requests, filters, or animation work per move.
const paperTexture = "repeating-linear-gradient(12deg, transparent 0 5px, rgba(70,49,32,.035) 5px 6px), repeating-linear-gradient(102deg, transparent 0 11px, rgba(255,255,255,.09) 11px 12px)";
export const BOARD_THEME_STYLES: Record<ChessTheme, { lightSquareStyle: CSSProperties; darkSquareStyle: CSSProperties; lightSquareNotationStyle: CSSProperties; darkSquareNotationStyle: CSSProperties }> = {
  academy: {
    lightSquareStyle: { backgroundColor: "#cffafe" },
    darkSquareStyle: { backgroundColor: "#0e7490" },
    lightSquareNotationStyle: { color: "#865a29" },
    darkSquareNotationStyle: { color: "#ffe0a6" }
  },
  paper: {
    lightSquareStyle: { backgroundColor: "#f2eadb", backgroundImage: paperTexture },
    darkSquareStyle: { backgroundColor: "#b49b7a", backgroundImage: paperTexture },
    lightSquareNotationStyle: { color: "#705536" },
    darkSquareNotationStyle: { color: "#3d3024" }
  }
};
