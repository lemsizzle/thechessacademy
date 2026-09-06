import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { appearanceStorageKey, BOARD_THEME_STYLES, DEFAULT_BOARD_APPEARANCE, parseBoardAppearance, unlockedAppearance } from "@/chess/appearance/themes";
import { paperPieces } from "@/chess/appearance/PaperPieces";
import { paperChessSet } from "@/lib/avatar/paperChessSet";
import { defaultAvatarItemSlugs, getDefaultEquippedItems, normalizeAvatarCategory, seedAvatarItems } from "@/lib/avatar/catalog";
import { AvatarRenderer } from "@/components/avatar/AvatarRenderer";
import { canPurchaseAvatarItem } from "@/lib/avatar/rules";

describe("purchasable board appearance", () => {
  it.each([null, "bad-json", "null", "[]", '"paper"', '{"boardTheme":"unknown","pieceTheme":3}'])("safely defaults malformed stored preferences: %s", (input) => {
    expect(parseBoardAppearance(input)).toEqual(DEFAULT_BOARD_APPEARANCE);
  });
  it("remembers board and pieces separately, with student-scoped keys", () => {
    expect(parseBoardAppearance('{"boardTheme":"paper"}')).toEqual({ boardTheme: "paper", pieceTheme: "academy" });
    expect(parseBoardAppearance('{"pieceTheme":"paper"}')).toEqual({ boardTheme: "academy", pieceTheme: "paper" });
    expect(appearanceStorageKey("student-a")).not.toBe(appearanceStorageKey("student-b"));
  });
  it("stored preferences cannot unlock an unowned set", () => {
    const paper = { boardTheme: "paper", pieceTheme: "paper" } as const;
    expect(unlockedAppearance(paper, false)).toEqual(DEFAULT_BOARD_APPEARANCE);
    expect(unlockedAppearance(paper, true)).toEqual(paper);
  });
  it("has a complete, distinct 12-piece set, including promotion pieces", () => {
    expect(Object.keys(paperPieces).sort()).toEqual(["bB", "bK", "bN", "bP", "bQ", "bR", "wB", "wK", "wN", "wP", "wQ", "wR"]);
    const art = Object.entries(paperPieces).map(([code, Piece]) => {
      const svg = renderToStaticMarkup(createElement(Piece));
      expect(svg).toContain(`data-paper-piece="${code}"`);
      expect(svg).toContain('viewBox="0 0 64 64"');
      expect(svg).not.toContain("<image");
      return svg;
    });
    expect(new Set(art).size).toBe(12);
    expect(BOARD_THEME_STYLES.paper.lightSquareStyle.backgroundColor).not.toBe(BOARD_THEME_STYLES.paper.darkSquareStyle.backgroundColor);
  });
  it("sells Paper for coins and never equips/grants it as a starter avatar item", () => {
    expect(paperChessSet).toMatchObject({ category: "board_theme", rarity: "Rare", price: 800, unlockType: "purchase" });
    expect(normalizeAvatarCategory("board_theme")).toBe("board_theme");
    expect(seedAvatarItems).toContain(paperChessSet);
    expect(defaultAvatarItemSlugs).not.toContain(paperChessSet.slug);
    expect(getDefaultEquippedItems().board_theme).toBeUndefined();
    const wallet = { studentId: "student", academyCoins: 800, totalCoinsEarned: 800, totalCoinsSpent: 0 };
    expect(canPurchaseAvatarItem({ ...wallet, academyCoins: 799 }, paperChessSet, new Set()).ok).toBe(false);
    expect(canPurchaseAvatarItem(wallet, paperChessSet, new Set()).ok).toBe(true);
    expect(canPurchaseAvatarItem(wallet, paperChessSet, new Set([paperChessSet.id])).ok).toBe(false);
  });
  it("never renders a board-theme cosmetic over an avatar", () => {
    const markup = renderToStaticMarkup(createElement(AvatarRenderer, { items: [paperChessSet], avatar: { studentId: "student", equippedItems: { board_theme: paperChessSet.id } } }));
    expect(markup).not.toContain(paperChessSet.assetUrl);
  });
});
