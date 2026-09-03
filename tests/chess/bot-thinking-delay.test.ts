import { describe, expect, it } from "vitest";
import { createBotThinkingDelay, MAX_BOT_THINKING_DELAY_MS } from "@/chess/bots/thinkingDelay";

const QUIET_POSITION = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
const TACTICAL_POSITION = "4k3/8/8/3q4/3Q4/8/8/4K3 w - - 0 1";

describe("bot thinking delay", () => {
  it("takes longer for a complicated position with the same random roll", () => {
    const options = { remainingMs: null, incrementMs: 0, random: () => 0.65 };

    expect(createBotThinkingDelay({ fen: TACTICAL_POSITION, ...options }))
      .toBeGreaterThan(createBotThinkingDelay({ fen: QUIET_POSITION, ...options }));
  });

  it("never exceeds the 45 second ceiling", () => {
    expect(createBotThinkingDelay({
      fen: TACTICAL_POSITION,
      remainingMs: null,
      incrementMs: 0,
      random: () => 1
    })).toBeLessThanOrEqual(MAX_BOT_THINKING_DELAY_MS);
  });

  it("shortens the delay when the bot has little clock time remaining", () => {
    const delay = createBotThinkingDelay({
      fen: TACTICAL_POSITION,
      remainingMs: 10_000,
      incrementMs: 2_000,
      random: () => 1
    });

    expect(delay).toBeLessThanOrEqual(2_400);
  });

  it("keeps quiet opening replies in a clearly visible range", () => {
    expect(createBotThinkingDelay({
      fen: QUIET_POSITION,
      remainingMs: null,
      incrementMs: 0,
      random: () => 0
    })).toBe(2_000);
    expect(createBotThinkingDelay({
      fen: QUIET_POSITION,
      remainingMs: null,
      incrementMs: 0,
      random: () => 1
    })).toBe(6_500);
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
