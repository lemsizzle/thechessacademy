import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { arenaClock, arenaFinalLabel, arenaQueueLabel } from "@/chess/arena/presentation";
import type { ArenaQueueState, InternalArenaLobby } from "@/chess/arena/types";
import { ArenaLobbyView } from "@/components/tournaments/ArenaLobbyView";

const queue: ArenaQueueState = { status: "waiting", gameId: null, serverTime: "", queueEnabled: true, queueEnteredAt: "", tournamentStatus: "active", startsAt: "", endsAt: "", pairingsPaused: false, finalizing: false, points: 3 };
const lobby: InternalArenaLobby = {
  arena: { id: "arena", experienceVersion: 1, name: "Academy Arena", description: "", status: "finished", startsAt: "", endsAt: "", durationMinutes: 60, timeControlId: "10m", timeControl: { id: "10m", name: "10 min", initialMs: 600000, incrementMs: 0 }, rated: false, classGroup: null, standings: [], entry: null, createdAt: "", updatedAt: "" },
  pairings: [], messages: [], avatarItems: [], canChat: false
};
describe("Arena status and result presentation", () => {
  it("uses distinct registered, queued, paused, break, paired and final statuses", () => {
    expect(arenaQueueLabel(queue)).toBe("Finding an opponent");
    expect(arenaQueueLabel({ ...queue, tournamentStatus: "scheduled" })).toContain("Registered");
    expect(arenaQueueLabel({ ...queue, pairingsPaused: true })).toContain("teacher");
    expect(arenaQueueLabel({ ...queue, queueEnabled: false })).toBe("Taking a break");
    expect(arenaQueueLabel({ ...queue, status: "matched", gameId: "new" })).toContain("opening");
    expect(arenaQueueLabel({ ...queue, tournamentStatus: "finished", finalizing: true })).toContain("final results");
  });
  it("does not announce a final podium while a late game is active or settlement pending", () => {
    expect(arenaFinalLabel(lobby)).toBe("Confirming final results");
    expect(arenaFinalLabel({ ...lobby, pairings: [{ status: "active" } as InternalArenaLobby["pairings"][number]] })).toBe("Final games in progress");
    expect(arenaFinalLabel({ ...lobby, arena: { ...lobby.arena, finalResults: { standings: [], settledAt: "" } } })).toBe("Final results");
  });
  it("never lets the timer go negative", () => {
    expect(arenaClock(-3000)).toBe("0:00"); expect(arenaClock(62000)).toBe("1:02");
  });
  it("renders mobile tabs and no unconfirmed coin payouts", () => {
    const html = renderToStaticMarkup(<ArenaLobbyView lobby={lobby} now={0} role="student" status="Waiting" onJoin={() => {}} onPause={() => {}} onTogglePairings={() => {}} chat={<p>Chat</p>} />);
    expect(html).toContain('role="tablist"'); expect(html).toContain('aria-controls="arena-panel-Games"');
    expect(html).toContain("Confirming final results"); expect(html).not.toContain("prizes added to your wallets");
    expect(html).toContain("100"); expect(html).toContain("50"); expect(html).toContain("30 coins");
  });
});
