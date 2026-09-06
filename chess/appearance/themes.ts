import type { CSSProperties } from "react";

export const PAPER_CHESS_SET_SLUG = "paper-chess-set";
export const BLOSSOM_CHESS_SET_SLUG = "blossom-chess-set";
export const EIGHT_BIT_CHESS_SET_SLUG = "eight-bit-chess-set";
export const PURCHASABLE_CHESS_THEMES = {
  paper: { label: "Paper", slug: PAPER_CHESS_SET_SLUG },
  blossom: { label: "Blossom", slug: BLOSSOM_CHESS_SET_SLUG },
  eightBit: { label: "8-Bit", slug: EIGHT_BIT_CHESS_SET_SLUG }
} as const;
export type PurchasedChessTheme = keyof typeof PURCHASABLE_CHESS_THEMES;
export const purchasedChessThemes = Object.keys(PURCHASABLE_CHESS_THEMES) as PurchasedChessTheme[];
export type ChessTheme = "academy" | PurchasedChessTheme;
export type BoardAppearance = { boardTheme: ChessTheme; pieceTheme: ChessTheme };
export const DEFAULT_BOARD_APPEARANCE: BoardAppearance = { boardTheme: "academy", pieceTheme: "academy" };

export function chessThemeForSlug(slug: string): PurchasedChessTheme | null {
  return purchasedChessThemes.find((theme) => PURCHASABLE_CHESS_THEMES[theme].slug === slug) ?? null;
}

export function isChessSetInUse(slug: string, appearance: BoardAppearance) {
  const theme = chessThemeForSlug(slug);
  return theme !== null && (appearance.boardTheme === theme || appearance.pieceTheme === theme);
}

export function parseOwnedChessThemes(value: unknown): PurchasedChessTheme[] {
  return purchasedChessThemes.filter((theme) => Array.isArray(value) && value.includes(theme));
}

function parseTheme(value: unknown): ChessTheme {
  return purchasedChessThemes.includes(value as PurchasedChessTheme) ? value as PurchasedChessTheme : "academy";
}

export function appearanceStorageKey(studentId: string) {
  return `academy-board-appearance:v1:${studentId}`;
}

export function parseBoardAppearance(raw: string | null): BoardAppearance {
  try {
    const value: unknown = JSON.parse(raw ?? "null");
    if (!value || typeof value !== "object") return DEFAULT_BOARD_APPEARANCE;
    const preferences = value as Record<string, unknown>;
    return {
      boardTheme: parseTheme(preferences.boardTheme),
      pieceTheme: parseTheme(preferences.pieceTheme)
    };
  } catch { return DEFAULT_BOARD_APPEARANCE; }
}

export function unlockedAppearance(preferences: BoardAppearance, ownedThemes: readonly PurchasedChessTheme[]): BoardAppearance {
  const unlock = (theme: ChessTheme): ChessTheme => theme === "academy" || ownedThemes.includes(theme) ? theme : "academy";
  return { boardTheme: unlock(preferences.boardTheme), pieceTheme: unlock(preferences.pieceTheme) };
}

// CSS-only fibres: no large textures, image requests, filters, or animation work per move.
const paperTexture = "repeating-linear-gradient(12deg, transparent 0 5px, rgba(70,49,32,.035) 5px 6px), repeating-linear-gradient(102deg, transparent 0 11px, rgba(255,255,255,.09) 11px 12px)";
export const BOARD_THEME_STYLES: Record<ChessTheme, { lightSquareStyle: CSSProperties; darkSquareStyle: CSSProperties; lightSquareNotationStyle: CSSProperties; darkSquareNotationStyle: CSSProperties }> = {
  eightBit: {
    lightSquareStyle: { backgroundColor: "#a4d4c4", boxShadow: "inset 3px 3px #c5efda, inset -3px -3px #78afa6" },
    darkSquareStyle: { backgroundColor: "#414e76", boxShadow: "inset 3px 3px #56678f, inset -3px -3px #303b60" },
    lightSquareNotationStyle: { color: "#27304f", fontFamily: "monospace", fontWeight: 900 },
    darkSquareNotationStyle: { color: "#e3ffe9", fontFamily: "monospace", fontWeight: 900 }
  },
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
  },
  blossom: {
    lightSquareStyle: { backgroundColor: "#fff0f6", backgroundImage: "radial-gradient(circle at 20% 20%, #ffffff70 0 1px, transparent 1.5px)", backgroundSize: "14px 14px" },
    darkSquareStyle: { backgroundColor: "#ba84ab", backgroundImage: "linear-gradient(135deg, #ffffff10, transparent)" },
    lightSquareNotationStyle: { color: "#79365f" },
    darkSquareNotationStyle: { color: "#421c47" }
  }
};
