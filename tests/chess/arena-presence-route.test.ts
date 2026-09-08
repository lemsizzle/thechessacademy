import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ auth: vi.fn(), presence: vi.fn() }));
vi.mock("@/lib/auth/requireActiveStudent", () => ({ requireActiveStudent: mocks.auth, StudentAuthenticationError: class extends Error {} }));
vi.mock("@/chess/persistence/arenaServer", () => ({ arenaQueuePresence: mocks.presence, InternalArenaServerError: class extends Error {} }));
import { POST } from "@/app/api/student/internal-arenas/[tournamentId]/presence/route";
beforeEach(() => { vi.clearAllMocks(); mocks.auth.mockResolvedValue({ studentId: "authenticated-student" }); mocks.presence.mockResolvedValue({ status: "waiting" }); });
it("takes identity only from the verified session, not the client payload", async () => {
  const response = await POST(new Request("http://localhost", { method: "POST", body: JSON.stringify({ studentId: "other", action: "pause", gameId: "game" }) }), { params: Promise.resolve({ tournamentId: "arena" }) });
  expect(response.status).toBe(200);
  expect(mocks.presence).toHaveBeenCalledWith("arena", "authenticated-student", "pause", "game");
});
it("rejects client rank/prize actions before calling the queue", async () => {
  const response = await POST(new Request("http://localhost", { method: "POST", body: JSON.stringify({ action: "set-rank", rank: 1, coins: 999 }) }), { params: Promise.resolve({ tournamentId: "arena" }) });
  expect(response.status).toBe(400); expect(mocks.presence).not.toHaveBeenCalled();
});
it.each([null, [], { gameId: 123 }])("rejects malformed queue payloads: %j", async (body) => {
  const response = await POST(new Request("http://localhost", { method: "POST", body: JSON.stringify(body) }), { params: Promise.resolve({ tournamentId: "arena" }) });
  expect(response.status).toBe(400); expect(mocks.presence).not.toHaveBeenCalled();
});
