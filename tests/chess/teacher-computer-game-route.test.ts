import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ authorize: vi.fn(), load: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => ({ value: "session" }) }) }));
vi.mock("@/lib/auth/adminSession", () => ({ ADMIN_SESSION_COOKIE: "teacher-cookie", isAuthorizedAdminRequest: mocks.authorize }));
vi.mock("@/chess/persistence/liveGameServer", () => ({ getTeacherLiveGame: mocks.load, LiveGameServerError: class extends Error {} }));
import { GET } from "@/app/api/admin/live-games/[gameId]/route";
import { ComputerPresenceError } from "@/chess/live/computerPresence";
const params = { params: Promise.resolve({ gameId: "computer-56be1301-448a-4f10-b211-de23b8387bf5" }) };
beforeEach(() => { vi.clearAllMocks(); mocks.authorize.mockResolvedValue(true); mocks.load.mockResolvedValue({ id: "computer-game", computerPractice: true }); });
it("requires teacher authorization before loading any computer game", async () => {
  mocks.authorize.mockResolvedValue(false);
  expect((await GET(new Request("http://localhost"), params)).status).toBe(401);
  expect(mocks.load).not.toHaveBeenCalled();
});
it("returns an authorized computer snapshot using the existing teacher watch route", async () => {
  const response = await GET(new Request("http://localhost", { headers: { "x-admin-action-token": "teacher-action" } }), params);
  expect(response.status).toBe(200); expect(await response.json()).toMatchObject({ game: { computerPractice: true } });
  expect(mocks.authorize).toHaveBeenCalledWith("session", "teacher-action");
});
it("returns 404 for a replaced game so the spectator stops polling", async () => {
  mocks.load.mockRejectedValue(new ComputerPresenceError("Replaced game", 404));
  expect((await GET(new Request("http://localhost"), params)).status).toBe(404);
});
