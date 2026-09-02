import { beforeEach, describe, expect, it, vi } from "vitest";

const adminClientMock = vi.hoisted(() => {
  const limits: Array<{ source: string; value: number }> = [];
  const emptyResult = { data: [], error: null };
  const results: Record<string, { data: unknown[]; error: null }> = {};

  return {
    limits,
    results,
    client: {
      from(source: string) {
        const result = () => results[source] ?? emptyResult;
        const query = {
          select() {
            return query;
          },
          eq() {
            return query;
          },
          order() {
            return query;
          },
          limit(value: number) {
            limits.push({ source, value });
            return Promise.resolve(result());
          },
          then<TResult1 = ReturnType<typeof result>, TResult2 = never>(
            onfulfilled?: ((value: ReturnType<typeof result>) => TResult1 | PromiseLike<TResult1>) | null,
            onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
          ) {
            return Promise.resolve(result()).then(onfulfilled, onrejected);
          }
        };

        return query;
      }
    }
  };
});

vi.mock("server-only", () => ({}));

vi.mock("@/lib/supabase/admin", () => ({
  getSupabaseAdminClient: () => adminClientMock.client
}));

import { getAdminRosterActivity } from "@/lib/activity/adminRosterActivity";

describe("getAdminRosterActivity query limits", () => {
  beforeEach(() => {
    adminClientMock.limits.length = 0;
    for (const source of Object.keys(adminClientMock.results)) delete adminClientMock.results[source];
  });

  it("uses the requested result limit for every bounded activity source", async () => {
    await getAdminRosterActivity(40);

    expect(adminClientMock.limits).toHaveLength(10);
    expect(adminClientMock.limits.every(({ value }) => value === 40)).toBe(true);
  });

  it("keeps the 300-item default", async () => {
    await getAdminRosterActivity();

    expect(adminClientMock.limits).toHaveLength(10);
    expect(adminClientMock.limits.every(({ value }) => value === 300)).toBe(true);
  });

  it("adds the opponent to Academy game reward activity", async () => {
    adminClientMock.results.students = {
      data: [{ id: "student-1", display_name: "Yuvan", public_slug: "yuvan", class_group: "Monday Pawns" }],
      error: null
    };
    adminClientMock.results.xp_events = {
      data: [{ id: "xp-1", student_id: "student-1", amount: 10, reason: "Academy rapid game win.", created_at: "2026-09-02T02:16:13.583Z" }],
      error: null
    };
    adminClientMock.results.academy_activity_rewards = {
      data: [{ xp_event_id: "xp-1", source_id: "game-1", source_type: "web_game" }],
      error: null
    };
    adminClientMock.results.internal_chess_games = {
      data: [{ id: "game-1", opponent_name: "Pawny" }],
      error: null
    };

    const items = await getAdminRosterActivity(40);

    expect(items).toContainEqual(expect.objectContaining({
      id: "xp-xp-1",
      detail: "+10 XP and 10 coins - Academy rapid game win against Pawny."
    }));
  });
});
