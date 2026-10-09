import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ auth: vi.fn(), from: vi.fn(), rpc: vi.fn(), rows: [] as unknown[], filters: [] as unknown[] }));
vi.mock("@/lib/auth/requireActiveStudent", () => ({ requireActiveStudent: mocks.auth, StudentAuthenticationError: class extends Error {} }));
vi.mock("@/lib/supabase/server", () => ({ getSupabaseServiceClient: () => ({ from: mocks.from, rpc: mocks.rpc }) }));
import { GET, PATCH } from "@/app/api/student/displayed-badge/route";
import { StudentAuthenticationError } from "@/lib/auth/requireActiveStudent";

const studentId = "c97cb420-609c-4e43-b57d-183be4f4725a";
const badgeId = "97ae1da4-b212-4e5e-bb81-00baeb71a119";
const badge = { id: badgeId, name: "Fork Finder", category: "Tactics", tier: "A", final_image_url: "/badge.webp", art_image_url: null };
const request = (body: unknown) => new Request("http://localhost/api/student/displayed-badge", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

describe("earned badge display API", () => {
  beforeEach(() => {
    vi.clearAllMocks(); mocks.rows = [{ student_id: studentId, is_displayed: true, badges: badge }]; mocks.filters = [];
    mocks.auth.mockResolvedValue({ studentId }); mocks.rpc.mockResolvedValue({ data: badgeId, error: null });
    mocks.from.mockImplementation((_table: string) => {
      const query = { select: vi.fn(() => query), eq: vi.fn((...args: unknown[]) => { mocks.filters.push(args); return query; }), in: vi.fn((...args: unknown[]) => { mocks.filters.push(args); return query; }), then: (resolve: (value: unknown) => unknown) => Promise.resolve({ data: mocks.rows, error: null }).then(resolve) };
      return query;
    });
  });
  it("requires an active authenticated student before reading or changing a badge", async () => {
    mocks.auth.mockRejectedValue(new StudentAuthenticationError("Sign in first"));
    expect((await GET()).status).toBe(401);
    expect((await PATCH(request({ badgeId }))).status).toBe(401);
    expect(mocks.from).not.toHaveBeenCalled(); expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("only reads this student's selected earned badge and privately returns the current choice", async () => {
    const response = await GET();
    expect(await response.json()).toMatchObject({ ok: true, displayedBadge: { id: badgeId } });
    expect(mocks.filters).toContainEqual(["student_id", [studentId]]);
    expect(mocks.filters).toContainEqual(["is_displayed", true]);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  });
  it("writes the verified identity, ignoring client identity, without reward writes", async () => {
    const response = await PATCH(request({ badgeId, studentId: "someone-else", xp: 900 }));
    expect(await response.json()).toMatchObject({ ok: true, displayedBadge: { id: badgeId } });
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith("set_student_displayed_badge", { p_student_id: studentId, p_badge_id: badgeId });
    expect(mocks.from.mock.calls.every(call => call[0] === "student_badges")).toBe(true);
  });
  it("clears the choice and does not return a phantom display", async () => {
    mocks.rows = [];
    const response = await PATCH(request({ badgeId: null }));
    expect(await response.json()).toEqual({ ok: true, displayedBadge: null });
    expect(mocks.rpc).toHaveBeenCalledWith("set_student_displayed_badge", { p_student_id: studentId, p_badge_id: null });
  });
  it("rejects forged unearned badges and malformed input", async () => {
    mocks.rpc.mockResolvedValue({ error: { message: "Badge not earned by this student" } });
    expect((await PATCH(request({ badgeId }))).status).toBe(403);
    mocks.rpc.mockClear();
    expect((await PATCH(request({ badgeId: "wrong" }))).status).toBe(400);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("reports storage failure without exposing private database errors or claiming success", async () => {
    mocks.rpc.mockResolvedValue({ error: { message: "private database detail" } });
    const response = await PATCH(request({ badgeId }));
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain("private database detail");
  });
});
