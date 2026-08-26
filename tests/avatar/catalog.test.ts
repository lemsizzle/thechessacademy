import { describe, expect, it } from "vitest";
import { AVATAR_NEW_ITEM_WINDOW_DAYS, getDefaultEquippedItems, isAvatarItemEquipped, isAvatarItemNew, seedAvatarItems } from "../../lib/avatar/catalog";

function decodedSvg(slug: string) {
  const item = seedAvatarItems.find((candidate) => candidate.slug === slug);
  if (!item?.assetUrl) throw new Error(`Missing avatar asset: ${slug}`);
  return decodeURIComponent(item.assetUrl);
}

describe("avatar structural layers", () => {
  it("includes the torso in every skin tone asset", () => {
    const skinTones = seedAvatarItems.filter((item) => item.category === "skin_tone");
    expect(skinTones.length).toBeGreaterThan(0);
    for (const skinTone of skinTones) {
      expect(decodedSvg(skinTone.slug)).toContain("M31 160v-28");
    }
  });

  it("keeps the torso out of the base face asset", () => {
    expect(decodedSvg("academy-face")).not.toContain("M31 160v-28");
  });

  it("always equips a default skin tone", () => {
    const equipped = getDefaultEquippedItems();
    expect(equipped.skin_tone).toBe("warm-skin-tone");
  });

  it("identifies only the item occupying its avatar slot as equipped", () => {
    const equipped = getDefaultEquippedItems();
    const equippedShirt = seedAvatarItems.find((item) => item.slug === "academy-shirt");
    const unequippedShirt = seedAvatarItems.find((item) => item.slug === "chessboard-t-shirt");
    if (!equippedShirt || !unequippedShirt) throw new Error("Missing clothing fixtures.");

    expect(isAvatarItemEquipped(equippedShirt, equipped)).toBe(true);
    expect(isAvatarItemEquipped(unequippedShirt, equipped)).toBe(false);
  });

  it("treats items added within the last three weeks as new", () => {
    const now = Date.parse("2026-08-26T12:00:00.000Z");
    const fixture = seedAvatarItems[0];
    const atCutoff = new Date(now - AVATAR_NEW_ITEM_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();
    const beforeCutoff = new Date(Date.parse(atCutoff) - 1).toISOString();

    expect(isAvatarItemNew({ ...fixture, createdAt: atCutoff }, now)).toBe(true);
    expect(isAvatarItemNew({ ...fixture, createdAt: beforeCutoff }, now)).toBe(false);
    expect(isAvatarItemNew({ ...fixture, createdAt: new Date(now + 1).toISOString() }, now)).toBe(false);
    expect(isAvatarItemNew({ ...fixture, createdAt: "not-a-date" }, now)).toBe(false);
  });
});
