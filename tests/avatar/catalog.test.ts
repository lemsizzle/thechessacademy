import { describe, expect, it } from "vitest";
import { getDefaultEquippedItems, seedAvatarItems } from "../../lib/avatar/catalog";

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
});
