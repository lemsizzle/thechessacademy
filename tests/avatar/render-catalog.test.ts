import { describe, expect, it } from "vitest";
import { avatarRenderCatalog } from "@/lib/avatar/renderCatalog";
import type { AvatarItem } from "@/lib/types";

describe("avatar rendering catalog", () => {
  it("reuses one index for repeated avatar renders", () => {
    const defaults = [{ id: "face", name: "Default" }] as AvatarItem[];
    const items = [{ id: "hair", name: "Hair" }] as AvatarItem[];
    expect(avatarRenderCatalog(defaults, items)).toBe(avatarRenderCatalog(defaults, items));
    expect(avatarRenderCatalog(defaults, items).size).toBe(2);
  });
  it("preserves server overrides and refreshes when the catalog changes", () => {
    const defaults = [{ id: "face", name: "Default" }] as AvatarItem[];
    const items = [{ id: "face", name: "Updated" }] as AvatarItem[];
    expect(avatarRenderCatalog(defaults, items).get("face")?.name).toBe("Updated");
    const updated = [{ id: "face", name: "Newest" }] as AvatarItem[];
    expect(avatarRenderCatalog(defaults, updated)).not.toBe(avatarRenderCatalog(defaults, items));
    expect(avatarRenderCatalog(defaults, updated).get("face")?.name).toBe("Newest");
  });
});
