import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const row = {
    id: "quest-1",
    title: "Training Quest",
    description: "Complete a training session.",
    type: "weekly",
    status: "available",
    is_live: true,
    xp_reward: 100,
    badge_reward_id: null,
    is_active: false,
    starts_at: null,
    ends_at: null,
    created_at: "2026-09-01T00:00:00Z",
    updated_at: "2026-09-01T00:00:00Z"
  };
  const query = {
    update: vi.fn(),
    eq: vi.fn(),
    select: vi.fn(),
    single: vi.fn()
  };
  query.update.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.select.mockReturnValue(query);
  query.single.mockResolvedValue({ data: row, error: null });

  return {
    row,
    query,
    client: { from: vi.fn(() => query) }
  };
});

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/admin", () => ({
  getSupabaseAdminClient: () => mocks.client
}));

import { setAdminQuestActive } from "@/lib/quests/supabaseQuests";

describe("setAdminQuestActive", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.query.update.mockReturnValue(mocks.query);
    mocks.query.eq.mockReturnValue(mocks.query);
    mocks.query.select.mockReturnValue(mocks.query);
    mocks.query.single.mockResolvedValue({ data: mocks.row, error: null });
  });

  it("updates only the quest activation field and returns the mapped quest", async () => {
    const quest = await setAdminQuestActive("quest-1", false);

    expect(mocks.client.from).toHaveBeenCalledWith("academy_quests");
    expect(mocks.query.update).toHaveBeenCalledWith({ is_active: false });
    expect(mocks.query.eq).toHaveBeenCalledWith("id", "quest-1");
    expect(quest).toMatchObject({ id: "quest-1", isActive: false, isLive: true });
  });
});
