import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ auth: vi.fn(), rpc: vi.fn() }));
vi.mock("@/lib/auth/requireActiveStudent", () => ({
  requireActiveStudent: mocks.auth,
  StudentAuthenticationError: class extends Error {}
}));
vi.mock("@/lib/supabase/admin", () => ({ getSupabaseAdminClient: () => ({ rpc: mocks.rpc }) }));
import { StudentAuthenticationError } from "@/lib/auth/requireActiveStudent";
import { GET } from "@/app/api/student/puzzle-training/rewards/route";

const sessionId = "30000000-0000-4000-8000-000000000003";
const studentId = "20000000-0000-4000-8000-000000000002";
const empty = { xp: 0, puzzleCoins: 0, badgeCoins: 0, badges: [] };
const request = (query = `sessionId=${sessionId}`) => new NextRequest(`http://localhost/api/student/puzzle-training/rewards?${query}`);

describe("Survival round rewards API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.auth.mockResolvedValue({ studentId });
    mocks.rpc.mockResolvedValue({ data: empty, error: null });
  });
  it("uses only the signed-in identity, never a client studentId", async () => {
    const response = await GET(request(`sessionId=${sessionId}&studentId=someone-else`));
    expect(response.status).toBe(200);
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith("get_survival_round_rewards", { p_student_id: studentId, p_session_id: sessionId });
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  });
  it("returns the saved XP, coins and artwork without calculating rewards again", async () => {
    const saved = { xp: 20, puzzleCoins: 20, badgeCoins: 20, badges: [{ badgeId: "pin", imageUrl: "/pin.png", coins: 20 }] };
    mocks.rpc.mockResolvedValue({ data: saved, error: null });
    expect(await (await GET(request())).json()).toEqual(saved);
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
  });
  it("returns empty totals for an unrecorded round", async () => {
    expect(await (await GET(request())).json()).toEqual(empty);
  });
  it.each(["", "sessionId=bad", "sessionId=' OR true"])("rejects invalid round %s", async query => {
    expect((await GET(request(query))).status).toBe(400);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("requires an active signed-in student before querying", async () => {
    mocks.auth.mockRejectedValue(new StudentAuthenticationError("Log in"));
    expect((await GET(request())).status).toBe(401);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("reports errors instead of inventing zero rewards or exposing database details", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      mocks.rpc.mockResolvedValue({ error: { message: "private database details" }, data: null });
      const response = await GET(request());
      expect(response.status).toBe(500);
      expect(await response.text()).not.toContain("private database details");
    } finally { log.mockRestore(); }
  });
});
