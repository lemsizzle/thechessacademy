import { createElement, type ComponentType } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, it, expect } from "vitest";
import { narutoPieces } from "@/chess/appearance/NarutoPieces";
import { ChessSetPreview } from "@/chess/appearance/ChessSetPreview";
import { narutoChessSet } from "@/lib/avatar/narutoChessSet";
import { seedAvatarItems, defaultAvatarItemSlugs } from "@/lib/avatar/catalog";
import { parseBoardAppearance, unlockedAppearance, chessThemeForSlug } from "@/chess/appearance/themes";

describe("Naruto Mythic bundle", () => {
  it("costs 1000 coins and includes a purchased board theme", () => {
    expect(narutoChessSet).toMatchObject({ price: 1000, rarity: "Mythic", category: "board_theme", unlockType: "purchase" });
    expect(seedAvatarItems).toContain(narutoChessSet);
    expect(defaultAvatarItemSlugs).not.toContain(narutoChessSet.slug);
    expect(chessThemeForSlug(narutoChessSet.slug)).toBe("naruto");
  });
  it("has every piece including promotions, without animation or external assets", () => {
    expect(Object.keys(narutoPieces).sort()).toEqual(["bB","bK","bN","bP","bQ","bR","wB","wK","wN","wP","wQ","wR"]);
    for (const [code, Piece] of Object.entries(narutoPieces)) {
      const html = renderToStaticMarkup(createElement(Piece as ComponentType));
      expect(html).toContain(`data-naruto-piece="${code}"`);
      expect(html).not.toMatch(/<image|<animate|<filter/);
    }
  });
  it("assigns the requested characters to recognizable chess roles", () => {
    const assignments = { wN: "kurama", bN: "susanoo", wK: "hokage", bK: "hokage", wQ: "tsunade", bQ: "tsunade", wB: "shinobi-bishop", bB: "shinobi-bishop" };
    for (const [code, character] of Object.entries(assignments)) {
      const Piece = narutoPieces[code as keyof typeof narutoPieces];
      const html = renderToStaticMarkup(createElement(Piece as ComponentType));
      expect(html).toContain(`data-character="${character}"`);
      expect(html.includes('data-nine-tails="true"')).toBe(code === "wN");
    }
  });
  it("keeps both pawns round and free of busy chakra effects", () => {
    for (const code of ["wP", "bP"] as const) {
      const html = renderToStaticMarkup(createElement(narutoPieces[code] as ComponentType));
      expect(html).toContain('data-character="shinobi-pawn"');
      expect(html).toContain('data-pawn-head="round"');
      expect(html).not.toContain('data-chakra');
    }
  });
  it("prevents unowned use while allowing mix and match", () => {
    const appearance = { boardTheme: "naruto", pieceTheme: "paper" } as const;
    expect(parseBoardAppearance(JSON.stringify(appearance))).toEqual(appearance);
    expect(unlockedAppearance(appearance, ["paper"])).toEqual({ boardTheme: "academy", pieceTheme: "paper" });
    expect(unlockedAppearance(appearance, ["naruto","paper"])).toEqual(appearance);
  });
  it("previews actual Naruto pieces with unique gradient IDs", () => {
    const html = renderToStaticMarkup(createElement(ChessSetPreview, { slug: narutoChessSet.slug }));
    expect(html).toContain("Naruto Chess Set");
    expect(html.match(/data-naruto-piece/g)).toHaveLength(8);
    const ids = [...html.matchAll(/id="([^"]+)"/g)].map(m => m[1]);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
