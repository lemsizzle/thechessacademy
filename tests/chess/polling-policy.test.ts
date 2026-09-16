import { describe, expect, it } from "vitest";
import { arenaPresencePollMs, liveGamePollMs, onlinePlayPollMs } from "@/lib/pollingPolicy";

describe("usage-aware polling", () => {
  it("keeps live fallback and waiting-room discovery fast but stops finished games", () => {
    expect(liveGamePollMs("waiting", false, false, false)).toBe(3000);
    expect(liveGamePollMs("active", false, false, false)).toBe(3000);
    expect(liveGamePollMs("active", false, false, true)).toBe(30000);
    expect(liveGamePollMs("active", false, true, true)).toBe(5000);
    expect(liveGamePollMs("completed", false, true, true)).toBeNull();
    expect(liveGamePollMs("cancelled", false, false, false)).toBeNull();
  });
  it("keeps queued players fresh within the 20-second arena presence window", () => {
    const queue = { status: "waiting", tournamentStatus: "active", finalizing: false, pairingsPaused: false };
    expect(arenaPresencePollMs(queue, true)).toBe(3000);
    expect(arenaPresencePollMs({ ...queue, status: "matched" }, true)).toBe(15000);
    expect(arenaPresencePollMs({ ...queue, tournamentStatus: "finished" }, true)).toBe(Infinity);
    expect(arenaPresencePollMs({ ...queue, tournamentStatus: "finished", finalizing: true }, true)).toBe(15000);
  });
  it("refreshes pending invitations faster than idle online lists", () => {
    expect(onlinePlayPollMs(true)).toBe(5000);
    expect(onlinePlayPollMs(false)).toBe(15000);
  });
});
