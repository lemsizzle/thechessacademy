import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ auth: vi.fn(), update: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) }));
vi.mock("@/lib/auth/adminSession", () => ({ ADMIN_SESSION_COOKIE: "admin", isAuthorizedAdminRequest: mocks.auth }));
vi.mock("@/chess/persistence/arenaServer", () => ({ updateInternalArenaStatus: mocks.update, InternalArenaServerError: class extends Error {} }));
import { PATCH } from "@/app/api/admin/internal-arenas/[tournamentId]/route";

beforeEach(() => { vi.clearAllMocks(); mocks.update.mockResolvedValue({ pairingsPaused: true }); });
const request = (action: string) => new Request("http://localhost/api/admin/internal-arenas/arena", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ action }) });
it("rejects students and unauthenticated callers before updating pairings", async () => {
  mocks.auth.mockResolvedValue(false);
  expect((await PATCH(request("pause_pairings"), { params: Promise.resolve({ tournamentId: "arena" }) })).status).toBe(401);
  expect(mocks.update).not.toHaveBeenCalled();
});
it.each(["pause_pairings", "resume_pairings"])("accepts the teacher's %s action", async (action) => {
  mocks.auth.mockResolvedValue(true);
  expect((await PATCH(request(action), { params: Promise.resolve({ tournamentId: "arena" }) })).status).toBe(200);
  expect(mocks.update).toHaveBeenCalledWith("arena", action);
});
