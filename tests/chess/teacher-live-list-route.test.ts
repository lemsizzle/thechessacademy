import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ authorize: vi.fn(), load: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => ({ value: "session" }) }) }));
vi.mock("@/lib/auth/adminSession", () => ({ ADMIN_SESSION_COOKIE: "teacher-cookie", isAuthorizedAdminRequest: mocks.authorize }));
vi.mock("@/chess/persistence/liveGameServer", () => ({ listTeacherLiveGames: mocks.load }));
import { GET } from "@/app/api/admin/live-games/route";
beforeEach(() => { vi.clearAllMocks(); mocks.authorize.mockResolvedValue(true); mocks.load.mockResolvedValue([]); });
it("authorizes before reading any preview IDs or game data", async () => {
  mocks.authorize.mockResolvedValue(false);
  expect((await GET(new Request("http://localhost/api/admin/live-games?watch=anything"))).status).toBe(401);
  expect(mocks.load).not.toHaveBeenCalled();
});
it("bounds the requested boards and prevents shared caching of teacher data", async () => {
  const id = "56be1301-448a-4f10-b211-de23b8387bf5";
  const result = await GET(new Request(`http://localhost/api/admin/live-games?watch=${id},computer-${id},bad`, { headers: { "x-admin-action-token": "token" } }));
  expect(mocks.load).toHaveBeenCalledWith([id, `computer-${id}`]);
  expect(result.headers.get("cache-control")).toBe("private, no-store");
  expect(await result.json()).toEqual({ ok: true, games: [] });
});
