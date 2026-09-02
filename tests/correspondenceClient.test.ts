import { describe, expect, it } from "vitest";
import {
  correspondenceAlerts,
  formatCorrespondenceTimeLeft,
  nextCorrespondenceGameToMove,
  readCorrespondenceInbox,
  type CorrespondenceGameSummary
} from "@/lib/correspondence/clientTypes";

function correspondenceGame(overrides: Partial<CorrespondenceGameSummary>): CorrespondenceGameSummary {
  return {
    id: "game-1",
    opponent: null,
    viewerColor: "white",
    activeColor: "white",
    status: "active",
    turnDeadlineAt: "2026-09-05T12:00:00.000Z",
    updatedAt: "2026-09-02T12:00:00.000Z",
    gameMode: "correspondence",
    ...overrides
  };
}

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

  it("chooses the most urgent different game that needs the student's move", () => {
    const next = nextCorrespondenceGameToMove([
      correspondenceGame({ id: "current", turnDeadlineAt: "2026-09-03T12:00:00.000Z" }),
      correspondenceGame({ id: "waiting", activeColor: "black", turnDeadlineAt: "2026-09-03T13:00:00.000Z" }),
      correspondenceGame({ id: "later", turnDeadlineAt: "2026-09-06T12:00:00.000Z" }),
      correspondenceGame({ id: "urgent", turnDeadlineAt: "2026-09-04T12:00:00.000Z" })
    ], "current");

    expect(next?.id).toBe("urgent");
  });

  it("returns no next game when every other game is waiting or finished", () => {
    expect(nextCorrespondenceGameToMove([
      correspondenceGame({ id: "current" }),
      correspondenceGame({ id: "waiting", activeColor: "black" }),
      correspondenceGame({ id: "finished", status: "completed" })
    ], "current")).toBeNull();
  });

  it("builds alerts for unseen challenges and games awaiting a move", () => {
    const inbox = {
      ...readCorrespondenceInbox({}),
      incoming: [{
        id: "challenge-1",
        status: "pending" as const,
        createdAt: "2026-09-02T12:00:00.000Z",
        expiresAt: "2026-09-09T12:00:00.000Z",
        seenAt: null,
        challenger: { id: "student-2", name: "Maya" },
        recipient: { id: "student-1", name: "Alex" }
      }],
      activeGames: [
        correspondenceGame({ id: "current", opponent: { id: "student-3", name: "Noah" } }),
        correspondenceGame({ id: "next", opponent: { id: "student-4", name: "Priya" } })
      ]
    };

    const alerts = correspondenceAlerts(inbox, "/student/play/correspondence/current");
    expect(alerts.map((alert) => alert.title)).toEqual(["Incoming chess challenge", "Your move"]);
    expect(alerts[1]?.message).toContain("Priya");
  });
});
