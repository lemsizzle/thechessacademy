import { beforeEach, describe, expect, it, vi } from "vitest";

const adminClientMock = vi.hoisted(() => {
  const limits: Array<{ source: string; value: number }> = [];
  const emptyResult = { data: [], error: null };

  return {
    limits,
    client: {
      from(source: string) {
        const query = {
          select() {
            return query;
          },
          order() {
            return query;
          },
          limit(value: number) {
            limits.push({ source, value });
            return Promise.resolve(emptyResult);
          },
          then<TResult1 = typeof emptyResult, TResult2 = never>(
            onfulfilled?: ((value: typeof emptyResult) => TResult1 | PromiseLike<TResult1>) | null,
            onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
          ) {
            return Promise.resolve(emptyResult).then(onfulfilled, onrejected);
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
  });

  it("uses the requested result limit for every bounded activity source", async () => {
    await getAdminRosterActivity(40);

    expect(adminClientMock.limits).toHaveLength(8);
    expect(adminClientMock.limits.every(({ value }) => value === 40)).toBe(true);
  });

  it("keeps the 300-item default", async () => {
    await getAdminRosterActivity();

    expect(adminClientMock.limits).toHaveLength(8);
    expect(adminClientMock.limits.every(({ value }) => value === 300)).toBe(true);
  });
});
