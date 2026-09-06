import { createElement, type CSSProperties, type ComponentType } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { eightBitPieces } from "@/chess/appearance/EightBitPieces";
import { ChessSetPreview } from "@/chess/appearance/ChessSetPreview";
import { chessThemeForSlug, isChessSetInUse, parseBoardAppearance, parseOwnedChessThemes, unlockedAppearance } from "@/chess/appearance/themes";
import { eightBitChessSet } from "@/lib/avatar/eightBitChessSet";
import { seedAvatarItems, defaultAvatarItemSlugs } from "@/lib/avatar/catalog";

describe("8-Bit Chess Set", () => {
  it("is an Epic 800-coin bundle, not a free avatar layer", () => {
    expect(eightBitChessSet).toMatchObject({ category: "board_theme", price: 800, rarity: "Epic", unlockType: "purchase" });
    expect(seedAvatarItems).toContain(eightBitChessSet);
    expect(defaultAvatarItemSlugs).not.toContain(eightBitChessSet.slug);
    expect(chessThemeForSlug(eightBitChessSet.slug)).toBe("eightBit");
  });
  it("has twelve distinct, pixel-sharp renderers including promotion pieces", () => {
    expect(Object.keys(eightBitPieces).sort()).toEqual(["bB", "bK", "bN", "bP", "bQ", "bR", "wB", "wK", "wN", "wP", "wQ", "wR"]);
    const art = Object.entries(eightBitPieces).map(([code, Piece]) => {
      const svg = renderToStaticMarkup(createElement(Piece as ComponentType<{ svgStyle?: CSSProperties }>, { svgStyle: { opacity: 0.5 } }));
      expect(svg).toContain(`data-eight-bit-piece="${code}"`);
      expect(svg).toContain('shape-rendering="crispEdges"');
      expect(svg).toContain('opacity:0.5');
      expect(svg).not.toMatch(/<image|<filter|<animate/);
      return svg;
    });
    expect(new Set(art).size).toBe(12);
  });
  it("requires its own entitlement and preserves mixed-set preferences", () => {
    const mixed = { boardTheme: "eightBit", pieceTheme: "blossom" } as const;
    expect(parseBoardAppearance(JSON.stringify(mixed))).toEqual(mixed);
    expect(unlockedAppearance(mixed, ["blossom"])).toEqual({ boardTheme: "academy", pieceTheme: "blossom" });
    expect(unlockedAppearance(mixed, ["eightBit", "blossom"])).toEqual(mixed);
    expect(unlockedAppearance(mixed, [])).toEqual({ boardTheme: "academy", pieceTheme: "academy" });
    expect(parseOwnedChessThemes(["eightBit", "eightBit", "unknown"])).toEqual(["eightBit"]);
    expect(isChessSetInUse(eightBitChessSet.slug, mixed)).toBe(true);
  });
  it("previews its actual pieces rather than Paper or Blossom art", () => {
    const html = renderToStaticMarkup(createElement(ChessSetPreview, { slug: eightBitChessSet.slug }));
    expect(html).toContain("8-Bit Chess Set");
    expect(html.match(/data-eight-bit-piece/g)).toHaveLength(8);
    expect(html).not.toContain("data-blossom-piece");
  });
});
