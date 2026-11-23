import { createElement, type ComponentType } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { minionsPieces } from "@/chess/appearance/MinionsPieces";
import { ChessSetPreview } from "@/chess/appearance/ChessSetPreview";
import { minionsChessSet } from "@/lib/avatar/minionsChessSet";
import { seedAvatarItems, defaultAvatarItemSlugs } from "@/lib/avatar/catalog";
import { chessThemeForSlug, parseBoardAppearance, parseOwnedChessThemes, unlockedAppearance } from "@/chess/appearance/themes";

describe("Minions chess bundle", () => {
  it("offers the full purchased set for 1000 coins without making it a starter item", () => {
    expect(minionsChessSet).toMatchObject({price: 1000, rarity: "Mythic", category: "board_theme", unlockType: "purchase"});
    expect(seedAvatarItems).toContain(minionsChessSet);
    expect(defaultAvatarItemSlugs).not.toContain(minionsChessSet.slug);
    expect(chessThemeForSlug(minionsChessSet.slug)).toBe("minions");
  });
  it("renders all twelve pieces, including promotion choices, without external image requests", () => {
    expect(Object.keys(minionsPieces).sort()).toEqual(["bB","bK","bN","bP","bQ","bR","wB","wK","wN","wP","wQ","wR"]);
    for (const [code, Piece] of Object.entries(minionsPieces)) {
      const html = renderToStaticMarkup(createElement(Piece as ComponentType));
      expect(html).toContain(`data-minions-piece="${code}"`);
      expect(html).not.toMatch(/<image|<animate|<filter|id="/);
    }
  });
  it("keeps bishops, pawns, knights and royal crowns visually distinct on both teams", () => {
    const silhouettes = {P: "round-goggle-pawn", R: "castle-rook", N: "goggled-horse-knight", B: "split-mitre-bishop", Q: "five-point-crown", K: "cross-crown"};
    for (const color of ["w", "b"]) {
      const rendered = Object.entries(silhouettes).map(([kind, silhouette]) => {
        const html = renderToStaticMarkup(createElement(minionsPieces[color + kind] as ComponentType));
        expect(html).toContain(`data-silhouette="${silhouette}"`);
        return html;
      });
      expect(new Set(rendered).size).toBe(6);
    }
  });
  it("restores saved mix-and-match preferences but refuses unowned themes", () => {
    const appearance = {boardTheme: "minions", pieceTheme: "naruto"} as const;
    expect(parseBoardAppearance(JSON.stringify(appearance))).toEqual(appearance);
    expect(parseOwnedChessThemes(["minions", "invalid", "minions"])).toEqual(["minions"]);
    expect(unlockedAppearance(appearance, ["naruto"])).toEqual({boardTheme: "academy", pieceTheme: "naruto"});
    expect(unlockedAppearance(appearance, ["minions", "naruto"])).toEqual(appearance);
    expect(unlockedAppearance({boardTheme: "paper", pieceTheme: "minions"}, ["paper"])).toEqual({boardTheme: "paper", pieceTheme: "academy"});
  });
  it("uses the actual playable pieces in store previews", () => {
    const html = renderToStaticMarkup(createElement(ChessSetPreview, {slug: minionsChessSet.slug}));
    expect(html).toContain("Minions Chess Set");
    expect(html.match(/data-minions-piece/g)).toHaveLength(8);
  });
});

