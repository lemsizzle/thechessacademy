import { describe, expect, it } from "vitest";
import { sortAvatarItemsNewestFirst } from "../../lib/avatar/supabaseAvatar";
import type { AvatarItem } from "../../lib/types";

function item(name: string, createdAt?: string): AvatarItem {
  return {
    id: name.toLowerCase().replaceAll(" ", "-"),
    name,
    slug: name.toLowerCase().replaceAll(" ", "-"),
    description: "",
    category: "headwear",
    rarity: "Common",
    price: 5,
    assetUrl: null,
    thumbnailUrl: null,
    layerOrder: 70,
    unlockType: "purchase",
    unlockRequirement: null,
    isActive: true,
    isFeatured: false,
    createdAt
  };
}

describe("avatar store ordering", () => {
  it("sorts dated items newest first and keeps undated items last", () => {
    const items = [
      item("Older", "2026-07-01T00:00:00.000Z"),
      item("No Date"),
      item("Newest", "2026-08-04T00:00:00.000Z")
    ];

    expect(sortAvatarItemsNewestFirst(items).map((candidate) => candidate.name)).toEqual([
      "Newest",
      "Older",
      "No Date"
    ]);
  });

  it("uses the item name as a stable tie breaker", () => {
    const timestamp = "2026-08-04T00:00:00.000Z";
    expect(sortAvatarItemsNewestFirst([item("Zulu", timestamp), item("Alpha", timestamp)]).map((candidate) => candidate.name)).toEqual([
      "Alpha",
      "Zulu"
    ]);
  });
});
