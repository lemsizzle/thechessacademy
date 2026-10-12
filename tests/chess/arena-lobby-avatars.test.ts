import { describe, expect, it } from "vitest";
import { arenaBotAvatar } from "@/chess/arena/lobbyAvatars";
import type { AvatarItem } from "@/lib/types";

const items = Array.from({ length: 12 }, (_, index) => ({
  id: `hair-${index}`, category: "hair", assetUrl: `/hair-${index}.png`, isActive: true
} as AvatarItem));

describe("Arena store avatars", () => {
  it("is stable across refreshes, viewers and catalog ordering", () => {
    expect(arenaBotAvatar("arena", "bot", items)).toEqual(arenaBotAvatar("arena", "bot", [...items].reverse()));
  });
  it("varies between bots", () => {
    const outfits = new Set(Array.from({ length: 12 }, (_, i) => arenaBotAvatar("arena", `bot-${i}`, items).equippedItems.hair));
    expect(outfits.size).toBeGreaterThan(1);
  });
  it("excludes inactive, missing-art and board items", () => {
    const avatar = arenaBotAvatar("arena", "bot", [
      ...items,
      { id: "hidden", category: "clothing", isActive: false, assetUrl: "/hidden.png" },
      { id: "missing", category: "eyes", isActive: true, assetUrl: null },
      { id: "board", category: "board_theme", isActive: true, assetUrl: "/board.png" }
    ] as AvatarItem[]);
    expect(avatar.equippedItems).toMatchObject({ eyes: "bright-quest-eyes", mouth: "brave-smile" });
    expect(Object.values(avatar.equippedItems).filter((id) => !["bright-quest-eyes", "brave-smile"].includes(id!))).toHaveLength(1);
    expect(avatar.equippedItems.hair).toMatch(/^hair-/);
  });

  it("uses two or three random cosmetics over a simple face, consistently across filtered game payloads", () => {
    const catalog = ["hair", "clothing", "headwear", "glasses", "chess_accessory", "background", "aura_effect", "eyes"].flatMap((category) =>
      Array.from({ length: 4 }, (_, index) => ({ id: `${category}-${index}`, category, assetUrl: `/avatar/${category}-${index}.png`, isActive: true, unlockType: "purchase" } as AvatarItem))
    );
    const counts = new Set<number>();
    const outfits = new Set<string>();
    for (let index = 0; index < 40; index++) {
      const avatar = arenaBotAvatar("arena", `bot-${index}`, catalog);
      const equippedIds = new Set(Object.values(avatar.equippedItems));
      const cosmetics = catalog.filter((item) => equippedIds.has(item.id));
      expect(cosmetics.length).toBeGreaterThanOrEqual(2);
      expect(cosmetics.length).toBeLessThanOrEqual(3);
      expect(new Set(cosmetics.map((item) => item.category)).size).toBe(cosmetics.length);
      expect(avatar.equippedItems.eyes).toBeTruthy();
      expect(avatar.equippedItems.mouth).toBeTruthy();
      expect(arenaBotAvatar("arena", `bot-${index}`, [...catalog].reverse())).toEqual(avatar);
      expect(arenaBotAvatar("arena", `bot-${index}`, cosmetics)).toEqual(avatar);
      counts.add(cosmetics.length);
      outfits.add(JSON.stringify(avatar.equippedItems));
    }
    expect([...counts].sort()).toEqual([2, 3]);
    expect(outfits.size).toBeGreaterThan(1);
    expect(arenaBotAvatar("other-arena", "bot-0", catalog)).not.toEqual(arenaBotAvatar("arena", "bot-0", catalog));
  });

  it("keeps starter features without filling extra slots when the catalog is empty", () => {
    expect(arenaBotAvatar("arena", "bot", []).equippedItems).toEqual({ eyes: "bright-quest-eyes", mouth: "brave-smile" });
  });

  it("keeps default face choices stable with duplicate catalog slugs and reduced payloads", () => {
    const catalog = [
      ...items,
      ...["b-eyes", "a-eyes"].map((id) => ({ id, category: "eyes", slug: "bright-quest-eyes", assetUrl: "/eyes.png", isActive: true, unlockType: "default" } as AvatarItem)),
      { id: "plain-shirt", category: "clothing", assetUrl: "/shirt.png", isActive: true, unlockType: "default" } as AvatarItem
    ];
    const avatar = arenaBotAvatar("arena", "bot", catalog);
    expect(avatar.equippedItems.eyes).toBe("a-eyes");
    expect(avatar.equippedItems.clothing).toBeUndefined();
    expect(arenaBotAvatar("arena", "bot", [...catalog].reverse())).toEqual(avatar);
    expect(arenaBotAvatar("arena", "bot", catalog.filter((item) => Object.values(avatar.equippedItems).includes(item.id)))).toEqual(avatar);
  });
});
