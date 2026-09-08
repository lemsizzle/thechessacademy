import { describe, expect, it } from "vitest";
import { arenaBotThinkingRemainingMs } from "@/chess/arena/botThinking";
import type { LiveGameRecord } from "@/chess/live/types";

const now = Date.parse("2026-09-08T00:00:00Z");
function position(fen = "r1bq1rk1/ppp2ppp/2np1n2/2b1p3/2B1P3/2NP1N2/PPP2PPP/R1BQ1RK1 w - - 0 8") {
  return {
    id: "33333333-3333-4333-8333-333333333333", current_fen: fen, moves: [],
    white_ms: 600000, black_ms: 600000, active_color: "white",
    clock_started_at: new Date(now).toISOString(),
    time_control: { initialMs: 600000, incrementMs: 0 }
  } as unknown as LiveGameRecord;
}

describe("persisted Arena thinking deadline", () => {
  it("uses a stable deadline across reloads, leases, version changes, and server instances", () => {
    const game = position();
    const initial = arenaBotThinkingRemainingMs(game, now);
    const reloaded = { ...structuredClone(game), version: 50, bot_lease_until: new Date(now + 15000).toISOString() };
    expect(initial).toBeGreaterThan(0);
    expect(arenaBotThinkingRemainingMs(reloaded, now + 250)).toBe(initial - 250);
    expect(arenaBotThinkingRemainingMs(reloaded, now + initial)).toBe(0);
    expect(arenaBotThinkingRemainingMs(reloaded, now + 100000)).toBe(0);
  });

  it("varies the timing between games and turns", () => {
    const game = position();
    const delays = Array.from({ length: 30 }, (_, index) => arenaBotThinkingRemainingMs({ ...game, id: `game-${index}` }, now));
    expect(new Set(delays).size).toBeGreaterThan(20);
    expect(Math.max(...delays)).toBeLessThanOrEqual(45000);
  });

  it.each([
    ["8/8/8/4k3/8/3K4/6P1/8 w - - 0 1", 2500],
    ["8/8/8/8/8/8/8/kqK5 w - - 0 1", 750]
  ] as const)("keeps sparse/forced positions fast (%s)", (fen, maximum) => {
    for (let index = 0; index < 30; index += 1) {
      expect(arenaBotThinkingRemainingMs({ ...position(fen), id: `game-${index}` }, now)).toBeLessThanOrEqual(maximum);
    }
  });

  it("uses the active bot's remaining clock and removes increment allowance in Berserk", () => {
    const game = { ...position(), active_color: "black" as const, black_ms: 1000,
      time_control: { ...position().time_control, incrementMs: 5000 } };
    const normal = arenaBotThinkingRemainingMs(game, now);
    const berserk = arenaBotThinkingRemainingMs({ ...game, black_berserk: true }, now);
    expect(berserk).toBeLessThanOrEqual(350);
    expect(berserk).toBeLessThan(normal);
    expect(normal).toBeLessThanOrEqual(1000);
  });

  it("never waits past flag fall even below the shared minimum delay", () => {
    expect(arenaBotThinkingRemainingMs({ ...position(), white_ms: 100 }, now)).toBe(100);
    expect(arenaBotThinkingRemainingMs({ ...position(), white_ms: 100 }, now + 100)).toBe(0);
  });
});
