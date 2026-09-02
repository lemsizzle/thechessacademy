import { estimatePositionComplexity } from "@/chess/bots/humanMoveSelector";

export const MAX_BOT_THINKING_DELAY_MS = 45_000;

type BotThinkingDelayOptions = {
  fen: string;
  remainingMs: number | null;
  incrementMs: number;
  random?: () => number;
};

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

function clockAwareMaximum(remainingMs: number | null, incrementMs: number) {
  if (remainingMs === null) return MAX_BOT_THINKING_DELAY_MS;

  const availableThinkingTime = remainingMs * 0.08 + Math.max(0, incrementMs) * 0.8;
  return clamp(availableThinkingTime, 350, MAX_BOT_THINKING_DELAY_MS);
}

export function createBotThinkingDelay({
  fen,
  remainingMs,
  incrementMs,
  random = Math.random
}: BotThinkingDelayOptions) {
  const complexity = estimatePositionComplexity(fen);
  const complexityCurve = complexity ** 1.25;
  const minimumDelay = 850 + complexityCurve * 2_550;
  const maximumDelay = 2_600 + complexityCurve * (MAX_BOT_THINKING_DELAY_MS - 2_600);
  const randomValue = clamp(random(), 0, 1);
  const randomCurve = randomValue ** (1.35 - complexity * 0.5);
  const naturalDelay = minimumDelay + (maximumDelay - minimumDelay) * randomCurve;
  const maximumForClock = clockAwareMaximum(remainingMs, incrementMs);

  return Math.round(clamp(naturalDelay, 350, maximumForClock));
}
