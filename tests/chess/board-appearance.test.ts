import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { appearanceStorageKey, BOARD_THEME_STYLES, DEFAULT_BOARD_APPEARANCE, parseBoardAppearance, unlockedAppearance, parseOwnedChessThemes, chessThemeForSlug, isChessSetInUse } from "@/chess/appearance/themes";
import { paperPieces } from "@/chess/appearance/PaperPieces";
import { blossomPieces } from "@/chess/appearance/BlossomPieces";
import { ChessSetPreview } from "@/chess/appearance/ChessSetPreview";
import { blossomChessSet } from "@/lib/avatar/blossomChessSet";
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
    expect(unlockedAppearance(paper, [])).toEqual(DEFAULT_BOARD_APPEARANCE);
    expect(unlockedAppearance(paper, ["paper"])).toEqual(paper);
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
  it("sells Blossom for 400 coins without changing Paper's 800-coin price", () => {
    expect(blossomChessSet).toMatchObject({ category: "board_theme", price: 400, unlockType: "purchase", isActive: true });
    expect(seedAvatarItems).toContain(blossomChessSet);
    expect(defaultAvatarItemSlugs).not.toContain(blossomChessSet.slug);
    expect(paperChessSet.price).toBe(800);
    const wallet = { studentId: "student", academyCoins: 400, totalCoinsEarned: 400, totalCoinsSpent: 0 };
    expect(canPurchaseAvatarItem({ ...wallet, academyCoins: 399 }, blossomChessSet, new Set()).ok).toBe(false);
    expect(canPurchaseAvatarItem(wallet, blossomChessSet, new Set()).ok).toBe(true);
    expect(canPurchaseAvatarItem(wallet, blossomChessSet, new Set([blossomChessSet.id])).ok).toBe(false);
  });
  it("gates each half of mixed sets independently and keeps saved Paper preferences", () => {
    const mixed = { boardTheme: "blossom", pieceTheme: "paper" } as const;
    expect(parseBoardAppearance(JSON.stringify(mixed))).toEqual(mixed);
    expect(unlockedAppearance(mixed, ["blossom"])).toEqual({ boardTheme: "blossom", pieceTheme: "academy" });
    expect(unlockedAppearance(mixed, ["paper"])).toEqual({ boardTheme: "academy", pieceTheme: "paper" });
    expect(unlockedAppearance(mixed, ["paper", "blossom"])).toEqual(mixed);
    expect(unlockedAppearance(mixed, [])).toEqual(DEFAULT_BOARD_APPEARANCE);
    expect(parseOwnedChessThemes(["paper", "blossom", "paper", "unknown"])).toEqual(["paper", "blossom"]);
    expect(parseOwnedChessThemes({ blossom: true })).toEqual([]);
    expect(chessThemeForSlug(blossomChessSet.slug)).toBe("blossom");
    expect(chessThemeForSlug("not-a-set")).toBeNull();
    expect(isChessSetInUse(blossomChessSet.slug, mixed)).toBe(true);
    expect(isChessSetInUse(paperChessSet.slug, mixed)).toBe(true);
    expect(isChessSetInUse(blossomChessSet.slug, DEFAULT_BOARD_APPEARANCE)).toBe(false);
  });
  it("has twelve distinct Blossom pieces and the store shows the correct artwork", () => {
    expect(Object.keys(blossomPieces).sort()).toEqual(Object.keys(paperPieces).sort());
    const art = Object.entries(blossomPieces).map(([code, Piece]) => {
      const svg = renderToStaticMarkup(createElement(Piece));
      expect(svg).toContain(`data-blossom-piece="${code}"`);
      expect(svg).toContain('viewBox="0 0 64 64"');
      expect(svg).not.toMatch(/<image|<filter|<animate/);
      return svg;
    });
    expect(new Set(art).size).toBe(12);
    const preview = renderToStaticMarkup(createElement(ChessSetPreview, { slug: blossomChessSet.slug }));
    expect(preview).toContain("Blossom Chess Set");
    expect(preview).toContain("data-blossom-piece");
    expect(preview).not.toContain("data-paper-piece");
    expect(renderToStaticMarkup(createElement(ChessSetPreview, { slug: paperChessSet.slug }))).toContain("data-paper-piece");
    expect(renderToStaticMarkup(createElement(AvatarRenderer, { items: [blossomChessSet], avatar: { studentId: "student", equippedItems: { board_theme: blossomChessSet.id } } }))).not.toContain(blossomChessSet.assetUrl);
  });
});
