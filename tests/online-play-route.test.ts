import { beforeEach, expect, it, vi } from "vitest";
import { EMPTY_ONLINE_PLAY } from "@/lib/onlinePlay/types";
const mocks = vi.hoisted(() => ({ auth: vi.fn(), perform: vi.fn(), state: vi.fn() }));
vi.mock("@/lib/auth/requireActiveStudent", () => ({ requireActiveStudent: mocks.auth, StudentAuthenticationError: class extends Error {} }));
vi.mock("@/lib/onlinePlay/server", () => ({
  getOnlinePlay: mocks.state, performOnlineAction: mocks.perform,
  OnlinePlayError: class extends Error { constructor(message: string, readonly status = 400) { super(message); } }
}));
import { POST } from "@/app/api/student/online-play/route";
import { StudentAuthenticationError } from "@/lib/auth/requireActiveStudent";
const request = (body: unknown, origin?: string) => new Request("http://localhost/api/student/online-play", {
  method: "POST", body: JSON.stringify(body), headers: origin ? { origin } : {}
});
beforeEach(() => {
  vi.resetAllMocks();
  mocks.auth.mockResolvedValue({ studentId: "signed-in-student" });
  mocks.perform.mockResolvedValue(null);
  mocks.state.mockResolvedValue(EMPTY_ONLINE_PLAY);
});
it("authenticates once and reads fresh state after the presence write", async () => {
  mocks.state.mockImplementation(async () => {
    expect(mocks.perform).toHaveBeenCalledOnce();
    return EMPTY_ONLINE_PLAY;
  });
  const response = await POST(request({ action: "heartbeat", includeState: true, studentId: "spoofed" }));
  expect(response.status).toBe(200);
  expect(response.headers.get("Cache-Control")).toBe("no-store");
  expect(await response.json()).toEqual({ result: null, state: EMPTY_ONLINE_PLAY });
  expect(mocks.auth).toHaveBeenCalledOnce();
  expect(mocks.state).toHaveBeenCalledExactlyOnceWith("signed-in-student");
  expect(mocks.perform.mock.calls[0][0]).toBe("signed-in-student");
});
it.each([{ action: "heartbeat" }, { action: "challenge", includeState: true }, { action: "accept", includeState: true }])("keeps existing action responses for %j", async (body) => {
  expect(await (await POST(request(body))).json()).toEqual({ result: null });
  expect(mocks.state).not.toHaveBeenCalled();
});
it("rejects cross-origin combined requests before any work", async () => {
  expect((await POST(request({ action: "heartbeat", includeState: true }, "https://untrusted.test"))).status).toBe(403);
  expect(mocks.auth).not.toHaveBeenCalled();
  expect(mocks.state).not.toHaveBeenCalled();
});
it("rejects expired student access for combined requests", async () => {
  mocks.auth.mockRejectedValue(new StudentAuthenticationError("Student log in required."));
  expect((await POST(request({ action: "heartbeat", includeState: true }))).status).toBe(401);
  expect(mocks.perform).not.toHaveBeenCalled();
  expect(mocks.state).not.toHaveBeenCalled();
});
it("does not leak internal state-query errors", async () => {
  mocks.state.mockRejectedValue(new Error("private database details"));
  const response = await POST(request({ action: "heartbeat", includeState: true }));
  expect(response.status).toBe(500);
  expect(await response.json()).toEqual({ error: "Online play is unavailable." });
});
