import { createElement, type ComponentType } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { minecraftPieces } from "@/chess/appearance/MinecraftPieces";
import { ChessSetPreview } from "@/chess/appearance/ChessSetPreview";
import { minecraftChessSet } from "@/lib/avatar/minecraftChessSet";
import { seedAvatarItems, defaultAvatarItemSlugs } from "@/lib/avatar/catalog";
import { chessThemeForSlug, parseBoardAppearance, parseOwnedChessThemes, unlockedAppearance } from "@/chess/appearance/themes";

describe("Minecraft chess bundle", () => {
  it("offers the full purchased set for 1000 coins without making it a starter item", () => {
    expect(minecraftChessSet).toMatchObject({price: 1000, rarity: "Mythic", category: "board_theme", unlockType: "purchase"});
    expect(seedAvatarItems).toContain(minecraftChessSet);
    expect(defaultAvatarItemSlugs).not.toContain(minecraftChessSet.slug);
    expect(chessThemeForSlug(minecraftChessSet.slug)).toBe("minecraft");
  });
  it("renders all twelve pieces, including promotion choices, without external image requests", () => {
    expect(Object.keys(minecraftPieces).sort()).toEqual(["bB","bK","bN","bP","bQ","bR","wB","wK","wN","wP","wQ","wR"]);
    for (const [code, Piece] of Object.entries(minecraftPieces)) {
      const html = renderToStaticMarkup(createElement(Piece as ComponentType));
      expect(html).toContain(`data-minecraft-piece="${code}"`);
      expect(html).not.toMatch(/<image|<animate|<filter|id="/);
    }
  });
  it("keeps bishops, pawns, knights and royal crowns visually distinct on both teams", () => {
    const silhouettes = {P: "small-cube-pawn", R: "battlement-rook", N: "block-horse-knight", B: "split-diamond-mitre", Q: "three-point-crown", K: "cross-crown"};
    for (const color of ["w", "b"]) {
      const rendered = Object.entries(silhouettes).map(([kind, silhouette]) => {
        const html = renderToStaticMarkup(createElement(minecraftPieces[color + kind] as ComponentType));
        expect(html).toContain(`data-silhouette="${silhouette}"`);
        return html;
      });
      expect(new Set(rendered).size).toBe(6);
    }
  });
  it("restores saved mix-and-match preferences but refuses unowned themes", () => {
    const appearance = {boardTheme: "minecraft", pieceTheme: "naruto"} as const;
    expect(parseBoardAppearance(JSON.stringify(appearance))).toEqual(appearance);
    expect(parseOwnedChessThemes(["minecraft", "invalid", "minecraft"])).toEqual(["minecraft"]);
    expect(unlockedAppearance(appearance, ["naruto"])).toEqual({boardTheme: "academy", pieceTheme: "naruto"});
    expect(unlockedAppearance(appearance, ["minecraft", "naruto"])).toEqual(appearance);
    expect(unlockedAppearance({boardTheme: "paper", pieceTheme: "minecraft"}, ["paper"])).toEqual({boardTheme: "paper", pieceTheme: "academy"});
  });
  it("uses the actual playable pieces in store previews", () => {
    const html = renderToStaticMarkup(createElement(ChessSetPreview, {slug: minecraftChessSet.slug}));
    expect(html).toContain("Minecraft Chess Set");
    expect(html.match(/data-minecraft-piece/g)).toHaveLength(8);
  });
});
