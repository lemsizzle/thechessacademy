import { describe, expect, it, vi, beforeEach } from "vitest";
import { challengeIsPending, EMPTY_ONLINE_PLAY, ONLINE_CLOCKS, onlineChallengeLabel, type DirectChallenge } from "@/lib/onlinePlay/types";
import { parseOnlineAction } from "@/lib/onlinePlay/server";

const auth = vi.hoisted(() => ({ require: vi.fn() }));
vi.mock("@/lib/auth/requireActiveStudent", () => ({ requireActiveStudent: auth.require, StudentAuthenticationError: class extends Error {} }));
import { GET, POST } from "@/app/api/student/online-play/route";
import { StudentAuthenticationError } from "@/lib/auth/requireActiveStudent";

const student = { id: "user", name: "Student", busy: false };
const invitation: DirectChallenge = { id: "challenge", challengerId: "user", recipientId: "me", opponentName: "Student", timeControlId: "3+2", status: "pending", expiresAt: "2026-09-07T12:02:00Z", gameId: null };
describe("online challenges", () => {
  beforeEach(() => vi.clearAllMocks());
  it("only accepts supported timed clocks and valid IDs", () => {
    for (const clock of ONLINE_CLOCKS) expect(parseOnlineAction({ action: "challenge", recipientId: "00000000-0000-4000-8000-000000000001", timeControlId: clock.id }).action).toBe("challenge");
    for (const timeControlId of ["none", "1+0", null]) expect(() => parseOnlineAction({ action: "challenge", recipientId: "00000000-0000-4000-8000-000000000001", timeControlId })).toThrow();
    for (const input of [null, {}, { action: "challenge", recipientId: "bad", timeControlId: "3+2" }, { action: "accept", challengeId: "bad" }]) expect(() => parseOnlineAction(input)).toThrow();
  });
  it("accepts only the explicit invitation actions", () => {
    for (const action of ["accept", "decline", "cancel"]) expect(parseOnlineAction({ action, challengeId: "00000000-0000-4000-8000-000000000001" }).action).toBe(action);
    expect(parseOnlineAction({ action: "heartbeat", studentId: "spoofed" })).toEqual({ action: "heartbeat" });
  });
  it("expires invitations and prevents duplicate or busy-student buttons", () => {
    const now = Date.parse("2026-09-07T12:01:00Z");
    expect(challengeIsPending(invitation, now)).toBe(true);
    expect(challengeIsPending(invitation, now + 60_000)).toBe(false);
    expect(onlineChallengeLabel(student, EMPTY_ONLINE_PLAY, now)).toBe("Challenge");
    expect(onlineChallengeLabel({ ...student, busy: true }, EMPTY_ONLINE_PLAY, now)).toBe("Playing");
    expect(onlineChallengeLabel(student, { ...EMPTY_ONLINE_PLAY, busy: true }, now)).toBe("Finish your game");
    expect(onlineChallengeLabel(student, { ...EMPTY_ONLINE_PLAY, incoming: [invitation] }, now)).toBe("Incoming challenge");
    expect(onlineChallengeLabel(student, { ...EMPTY_ONLINE_PLAY, outgoing: [{ ...invitation, recipientId: "user" }] }, now)).toBe("Challenge sent");
    expect(onlineChallengeLabel(student, { ...EMPTY_ONLINE_PLAY, incoming: [invitation] }, now + 60_000)).toBe("Challenge");
  });
  it("requires an active signed-in student for reads and writes", async () => {
    auth.require.mockRejectedValue(new StudentAuthenticationError("Student log in required."));
    expect((await GET()).status).toBe(401);
    expect((await POST(new Request("http://localhost/api/student/online-play", { method: "POST", body: '{}' }))).status).toBe(401);
  });
  it("rejects cross-origin writes before authentication or database work", async () => {
    expect((await POST(new Request("http://localhost/api/student/online-play", { method: "POST", headers: { origin: "https://untrusted.test" }, body: '{}' }))).status).toBe(403);
    expect(auth.require).not.toHaveBeenCalled();
  });
});
