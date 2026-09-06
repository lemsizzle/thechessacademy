import { describe, expect, it } from "vitest";
import { createBotThinkingDelay, MAX_BOT_THINKING_DELAY_MS } from "@/chess/bots/thinkingDelay";

const QUIET_POSITION = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
const COMPLICATED_POSITION = "r1bq1rk1/ppp2ppp/2np1n2/2b1p3/2B1P3/2NP1N2/PPP2PPP/R1BQ1RK1 w - - 0 8";
const SPARSE_ENDGAME = "8/8/8/4k3/8/3K4/6P1/8 w - - 0 1";
const FORCED_REPLY = "8/8/8/8/8/8/8/kqK5 w - - 0 1";

describe("bot thinking delay", () => {
  it("takes longer for a complicated position with the same random roll", () => {
    const options = { remainingMs: null, incrementMs: 0, random: () => 0.65 };

    expect(createBotThinkingDelay({ fen: COMPLICATED_POSITION, ...options }))
      .toBeGreaterThan(createBotThinkingDelay({ fen: QUIET_POSITION, ...options }));
  });

  it("never exceeds the 45 second ceiling", () => {
    expect(createBotThinkingDelay({
      fen: COMPLICATED_POSITION,
      remainingMs: null,
      incrementMs: 0,
      random: () => 1
    })).toBeLessThanOrEqual(MAX_BOT_THINKING_DELAY_MS);
  });

  it("shortens the delay when the bot has little clock time remaining", () => {
    const delay = createBotThinkingDelay({
      fen: COMPLICATED_POSITION,
      remainingMs: 10_000,
      incrementMs: 2_000,
      random: () => 1
    });

    expect(delay).toBeLessThanOrEqual(2_400);
  });

  it("keeps quiet opening replies visible without treating them as maximal calculations", () => {
    const shortestDelay = createBotThinkingDelay({
      fen: QUIET_POSITION,
      remainingMs: null,
      incrementMs: 0,
      random: () => 0
    });
    const longestDelay = createBotThinkingDelay({
      fen: QUIET_POSITION,
      remainingMs: null,
      incrementMs: 0,
      random: () => 1
    });

    expect(shortestDelay).toBeGreaterThanOrEqual(1_000);
    expect(longestDelay).toBeGreaterThan(shortestDelay);
    expect(longestDelay).toBeLessThan(12_000);
  });

  it("responds quickly when a sparse endgame has few legal choices", () => {
    expect(createBotThinkingDelay({
      fen: SPARSE_ENDGAME,
      remainingMs: null,
      incrementMs: 0,
      random: () => 1
    })).toBeLessThanOrEqual(2_500);
  });

  it("plays a forced reply in under a second", () => {
    expect(createBotThinkingDelay({
      fen: FORCED_REPLY,
      remainingMs: null,
      incrementMs: 0,
      random: () => 1
    })).toBeLessThanOrEqual(750);
  });

  it("keeps consecutive quiet replies noticeably different", () => {
    const firstDelay = createBotThinkingDelay({
      fen: QUIET_POSITION,
      remainingMs: null,
      incrementMs: 0,
      random: () => 0.5
    });
    const nextDelay = createBotThinkingDelay({
      fen: QUIET_POSITION,
      remainingMs: null,
      incrementMs: 0,
      previousDelayMs: firstDelay,
      random: () => 0.5
    });

    expect(Math.abs(nextDelay - firstDelay)).toBeGreaterThanOrEqual(900);
  });
});
