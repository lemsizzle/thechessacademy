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
    expect(Object.keys(avatar.equippedItems)).toEqual(["hair"]);
  });
});
