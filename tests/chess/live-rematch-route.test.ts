import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireActiveStudent: vi.fn(),
  resolveLiveGameRematch: vi.fn()
}));

vi.mock("@/lib/auth/requireActiveStudent", () => {
  class StudentAuthenticationError extends Error {}
  return { StudentAuthenticationError, requireActiveStudent: mocks.requireActiveStudent };
});

vi.mock("@/chess/persistence/liveGameServer", () => {
  class LiveGameServerError extends Error {
    constructor(message: string, readonly status = 400) {
      super(message);
    }
  }
  return { LiveGameServerError, resolveLiveGameRematch: mocks.resolveLiveGameRematch };
});

import { POST } from "@/app/api/student/live-games/[gameId]/rematch/route";
import { LiveGameServerError } from "@/chess/persistence/liveGameServer";
import { StudentAuthenticationError } from "@/lib/auth/requireActiveStudent";

const studentId = "10000000-0000-4000-8000-000000000001";
const gameId = "20000000-0000-4000-8000-000000000002";

function request(body: Record<string, unknown>) {
  return new Request(`http://localhost/api/student/live-games/${gameId}/rematch`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
}

describe("live rematch decision route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireActiveStudent.mockResolvedValue({ studentId });
    mocks.resolveLiveGameRematch.mockResolvedValue({ status: "declined", gameId: null, source: { id: gameId } });
  });

  it.each(["request", "accept", "decline"] as const)("saves an explicit %s decision with the viewed game version", async (decision) => {
    const response = await POST(request({ decision, version: 7 }), { params: Promise.resolve({ gameId }) });

    expect(response.status).toBe(200);
    expect(mocks.resolveLiveGameRematch).toHaveBeenCalledWith(studentId, gameId, { decision, version: 7 });
  });

  it("returns conflict responses from the atomic rematch resolver", async () => {
    mocks.resolveLiveGameRematch.mockRejectedValueOnce(new LiveGameServerError("The game changed. Refresh and try again.", 409));

    const response = await POST(request({ decision: "decline", version: 4 }), { params: Promise.resolve({ gameId }) });

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({ ok: false, error: "The game changed. Refresh and try again." });
  });

  it("rejects unauthenticated rematch decisions before touching a game", async () => {
    mocks.requireActiveStudent.mockRejectedValueOnce(new StudentAuthenticationError("Student log in required."));

    const response = await POST(request({ decision: "decline", version: 4 }), { params: Promise.resolve({ gameId }) });

    expect(response.status).toBe(401);
    expect(mocks.resolveLiveGameRematch).not.toHaveBeenCalled();
  });
});
