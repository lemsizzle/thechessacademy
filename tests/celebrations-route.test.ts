import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ auth: vi.fn(), from: vi.fn(), queries: [] as Array<{ table: string; filters: Array<unknown> }> }));
vi.mock("@/lib/auth/requireActiveStudent", () => ({ requireActiveStudent: mocks.auth, StudentAuthenticationError: class extends Error {} }));
vi.mock("@/lib/supabase/admin", () => ({ getSupabaseAdminClient: () => ({ from: mocks.from }) }));
import { GET } from "@/app/api/student/celebrations/route";
import { StudentAuthenticationError } from "@/lib/auth/requireActiveStudent";
const request = (query = "") => new NextRequest(`http://localhost/api/student/celebrations?${query}`);
describe("saved award notifications", () => {
  beforeEach(() => {
    vi.clearAllMocks(); mocks.queries.length = 0;
    mocks.auth.mockResolvedValue({ studentId: "signed-in-student" });
    mocks.from.mockImplementation((table: string) => {
      const record = { table, filters: [] as unknown[] }; mocks.queries.push(record);
      const data = table === "student_badges" ? [{ badge_id: "badge-one" }] : table === "quest_completion_events" ? [{ id: "completion-one", quest_id: "quest-one" }] : table === "badges" ? [{ id: "badge-one", name: "Platinum" }] : [{ id: "quest-one", title: "Puzzle Streaker" }];
      const query = { select: vi.fn(() => query), eq: vi.fn((...args: unknown[]) => { record.filters.push(args); return query; }), gte: vi.fn(() => query), lte: vi.fn(() => query), order: vi.fn(() => query), limit: vi.fn(() => Promise.resolve({ data, error: null })), in: vi.fn(() => Promise.resolve({ data, error: null })) };
      return query;
    });
  });
  it("requires authentication", async () => {
    mocks.auth.mockRejectedValue(new StudentAuthenticationError());
    expect((await GET(request())).status).toBe(401);
    expect(mocks.from).not.toHaveBeenCalled();
  });
  it("starts without replaying historical awards", async () => {
    const response = await GET(request());
    expect((await response.json()).events).toEqual([]);
    expect(mocks.from).not.toHaveBeenCalled();
  });
  it("reads only the signed-in student's earned badges and completed quests", async () => {
    const response = await GET(request(`since=${new Date().toISOString()}&studentId=someone-else`));
    expect(await response.json()).toMatchObject({ events: [{ id: "badge:badge-one", kind: "badge", name: "Platinum" }, { id: "quest:completion-one", kind: "quest", name: "Puzzle Streaker" }] });
    expect(mocks.queries.slice(0, 2).every(query => query.filters.some(filter => JSON.stringify(filter) === JSON.stringify(["student_id", "signed-in-student"])))).toBe(true);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  });
  it("doesn't turn a database failure into invented success", async () => {
    mocks.from.mockImplementation(() => { throw new Error("private details"); });
    const response = await GET(request(`since=${new Date().toISOString()}`));
    expect(response.status).toBe(500);
    expect(await response.text()).not.toContain("private details");
  });
});
