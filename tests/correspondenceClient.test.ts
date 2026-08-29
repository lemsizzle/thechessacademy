import { describe, expect, it } from "vitest";
import { formatCorrespondenceTimeLeft, readCorrespondenceInbox } from "@/lib/correspondence/clientTypes";

describe("correspondence client helpers", () => {
  it("reads the nested inbox response without trusting unrelated fields", () => {
    const inbox = readCorrespondenceInbox({
      ok: true,
      inbox: {
        incoming: [{ id: "challenge-1" }],
        outgoing: [{ id: "challenge-2" }],
        activeGames: [{ id: "game-1" }],
        unreadCount: 2,
        realtimeTopic: "student-correspondence:opaque"
      }
    });

    expect(inbox.incoming).toHaveLength(1);
    expect(inbox.outgoing).toHaveLength(1);
    expect(inbox.activeGames).toHaveLength(1);
    expect(inbox.unreadCount).toBe(2);
    expect(inbox.realtimeTopic).toBe("student-correspondence:opaque");
  });

  it("falls back safely for malformed optional inbox values", () => {
    expect(readCorrespondenceInbox({ inbox: { incoming: null, unreadCount: -4 } })).toEqual({
      incoming: [],
      outgoing: [],
      activeGames: [],
      unreadCount: 0,
      realtimeTopic: null
    });
  });

  it("formats multi-day, hourly, minute, and expired deadlines", () => {
    const now = Date.UTC(2026, 7, 29, 12, 0, 0);
    expect(formatCorrespondenceTimeLeft(new Date(now + 2 * 86_400_000 + 3 * 3_600_000).toISOString(), now)).toBe("2d 3h left");
    expect(formatCorrespondenceTimeLeft(new Date(now + 4 * 3_600_000 + 12 * 60_000).toISOString(), now)).toBe("4h 12m left");
    expect(formatCorrespondenceTimeLeft(new Date(now + 9 * 60_000).toISOString(), now)).toBe("9m left");
    expect(formatCorrespondenceTimeLeft(new Date(now - 1).toISOString(), now)).toBe("Time expired");
  });
});
