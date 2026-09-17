import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  cache: new Map<string, Promise<unknown>>(),
  from: vi.fn(),
  invalidate: vi.fn(),
  catalogReads: 0,
  avatarReads: 0,
  equipped: "hat-one"
}));
vi.mock("next/cache", () => ({
  unstable_cache: (load: (...args: string[]) => Promise<unknown>) => (...args: string[]) => {
    const key = JSON.stringify(args);
    if (!mocks.cache.has(key)) mocks.cache.set(key, load(...args));
    return mocks.cache.get(key);
  },
  revalidateTag: mocks.invalidate
}));
vi.mock("@/lib/supabase/server", () => ({
  getSupabaseServiceClient: () => ({ from: mocks.from }),
  getSupabaseServerReadClient: () => ({ from: mocks.from }),
  isSupabaseServiceConfigured: () => true,
  isSupabaseProjectConfigured: () => true
}));
import { getStudentAvatarDisplayData, updateAvatarItem } from "@/lib/avatar/supabaseAvatar";

beforeEach(() => {
  mocks.cache.clear(); mocks.invalidate.mockClear(); mocks.catalogReads = 0; mocks.avatarReads = 0; mocks.equipped = "hat-one";
  mocks.invalidate.mockImplementation(() => mocks.cache.clear());
  mocks.from.mockImplementation((table: string) => {
    let ids: string[] = [];
    const item = { id: "hat", name: "Hat", slug: "hat", category: "headwear", rarity: "Common", is_active: true };
    const query = {
      select: () => query, order: () => query, eq: () => query, update: () => query,
      in: (_column: string, values: string[]) => { ids = values; return query; },
      single: async () => ({ data: item, error: null }),
      then: (resolve: (value: unknown) => unknown) => {
        if (table === "avatar_items") mocks.catalogReads++; else mocks.avatarReads++;
        return Promise.resolve({ error: null, data: table === "avatar_items" ? [item] : ids.map(id => ({ student_id: id, equipped_items: { headwear: mocks.equipped } })) }).then(resolve);
      }
    };
    return query;
  });
});

describe("avatar display egress", () => {
  it("shares catalog reads across players while reading each player's current equipment", async () => {
    const first = await getStudentAvatarDisplayData(["learner-one"]);
    mocks.equipped = "hat-two";
    const second = await getStudentAvatarDisplayData(["learner-two"]);
    expect(mocks.catalogReads).toBe(1);
    expect(mocks.avatarReads).toBe(2);
    expect(first.avatars["learner-one"].equippedItems.headwear).toBe("hat-one");
    expect(second.avatars["learner-two"].equippedItems.headwear).toBe("hat-two");
    expect(second.avatars["learner-one"]).toBeUndefined();
  });
  it("expires display metadata after an admin edit", async () => {
    await getStudentAvatarDisplayData([]);
    await updateAvatarItem("hat", { isActive: false });
    expect(mocks.invalidate).toHaveBeenCalledWith("avatar-display-catalog", { expire: 0 });
    await getStudentAvatarDisplayData([]);
    expect(mocks.catalogReads).toBe(2);
  });
});
