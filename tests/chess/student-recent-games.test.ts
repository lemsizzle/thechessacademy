import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ auth: vi.fn(), from: vi.fn(), select: vi.fn(), eq: vi.fn(), order: vi.fn(), range: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => ({ value: "cookie" }) }) }));
vi.mock("@/lib/auth/adminSession", () => ({ ADMIN_SESSION_COOKIE: "admin", isAuthorizedAdminRequest: mocks.auth }));
vi.mock("@/lib/supabase/server", () => ({ getSupabaseServiceClient: () => ({ from: mocks.from }) }));
import { GET } from "@/app/api/admin/students/[studentId]/games/route";
const id = "10000000-0000-4000-8000-000000000001";
const get = (page = "1", studentId = id) => GET(new Request(`http://localhost/api/admin/students/${studentId}/games?page=${page}`), { params: Promise.resolve({ studentId }) });
beforeEach(() => {
  vi.clearAllMocks();
  mocks.auth.mockResolvedValue(true);
  const query = { select: mocks.select, eq: mocks.eq, order: mocks.order, range: mocks.range };
  for (const fn of [mocks.from, mocks.select, mocks.eq, mocks.order]) fn.mockReturnValue(query);
  mocks.range.mockResolvedValue({ data: [], error: null });
});
describe("teacher student game history", () => {
  it("rejects non-teachers before querying private games", async () => {
    mocks.auth.mockResolvedValue(false);
    expect((await get()).status).toBe(401);
    expect(mocks.from).not.toHaveBeenCalled();
  });
  it.each(["0", "-1", "NaN", "1.5", "10001"])("rejects invalid page %s", async (page) => {
    expect((await get(page)).status).toBe(400);
    expect(mocks.from).not.toHaveBeenCalled();
  });
  it("rejects unsaved students", async () => {
    expect((await get("1", "local-student")).status).toBe(400);
  });
  it("filters by selected student and fetches summaries only with stable pagination", async () => {
    mocks.range.mockResolvedValue({ data: Array.from({ length: 21 }, (_, i) => ({ id: String(i), result: "loss", opponent_name: "Bot", player_color: "black" })), error: null });
    const response = await get("2");
    const body = await response.json();
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(mocks.eq).toHaveBeenCalledWith("player_id", id);
    expect(mocks.range).toHaveBeenCalledWith(20, 40);
    expect(mocks.order).toHaveBeenCalledWith("id", { ascending: false });
    expect(mocks.select.mock.calls[0][0]).not.toMatch(/moves|pgn|fen/);
    expect(body.games).toHaveLength(20);
    expect(body.hasMore).toBe(true);
    expect(body.games[0]).toMatchObject({ result: "loss", playerColor: "black", opponentName: "Bot" });
  });
  it("returns an honest empty state", async () => {
    expect(await (await get()).json()).toEqual({ games: [], hasMore: false });
  });
  it("returns a retryable error without leaking database details", async () => {
    mocks.range.mockResolvedValue({ data: null, error: { message: "private database details" } });
    const response = await get();
    expect(response.status).toBe(500);
    expect(JSON.stringify(await response.json())).not.toContain("private database details");
  });
});
