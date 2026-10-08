import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ auth: vi.fn(), publish: vi.fn() }));
vi.mock("@/lib/auth/requireActiveStudent", () => ({ requireActiveStudent: mocks.auth, StudentAuthenticationError: class extends Error {} }));
vi.mock("@/chess/persistence/computerGamePresenceServer", () => ({ publishComputerGamePresence: mocks.publish }));
import { POST } from "@/app/api/student/computer-game-presence/route";
import { StudentAuthenticationError } from "@/lib/auth/requireActiveStudent";
import { ComputerPresenceError } from "@/chess/live/computerPresence";
beforeEach(() => { vi.clearAllMocks(); mocks.auth.mockResolvedValue({ studentId: "verified-student" }); mocks.publish.mockResolvedValue({ accepted: true }); });
it("uses the signed-in student's identity, ignoring forged student IDs", async () => {
  const body = { studentId: "someone-else", moves: [] };
  const response = await POST(new Request("http://localhost", { method: "POST", body: JSON.stringify(body) }));
  expect(response.status).toBe(200);
  expect(mocks.publish).toHaveBeenCalledWith("verified-student", body);
});
it("rejects unauthenticated students before reading or writing presence", async () => {
  mocks.auth.mockRejectedValue(new StudentAuthenticationError("Log in required"));
  expect((await POST(new Request("http://localhost", { method: "POST", body: "{}" }))).status).toBe(401);
  expect(mocks.publish).not.toHaveBeenCalled();
});
it.each(["{invalid-json", "a".repeat(16_001)])("rejects malformed or oversized snapshots before storage", async (body) => {
  expect((await POST(new Request("http://localhost", { method: "POST", body }))).status).toBe(400);
  expect(mocks.publish).not.toHaveBeenCalled();
});
it("returns storage failures without changing the completed-game reward route", async () => {
  mocks.publish.mockRejectedValue(new ComputerPresenceError("Unavailable", 503));
  expect((await POST(new Request("http://localhost", { method: "POST", body: "{}" }))).status).toBe(503);
});
