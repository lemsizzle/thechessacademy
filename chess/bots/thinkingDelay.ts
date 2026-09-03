import { estimatePositionComplexity } from "@/chess/bots/humanMoveSelector";

export const MAX_BOT_THINKING_DELAY_MS = 45_000;

type BotThinkingDelayOptions = {
  fen: string;
  remainingMs: number | null;
  incrementMs: number;
  previousDelayMs?: number | null;
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
  previousDelayMs = null,
  random = Math.random
}: BotThinkingDelayOptions) {
  const complexity = estimatePositionComplexity(fen);
  const complexityCurve = complexity ** 1.15;
  const minimumDelay = 2_000 + complexityCurve * 3_000;
  const maximumDelay = 6_500 + complexityCurve * (MAX_BOT_THINKING_DELAY_MS - 6_500);
  const randomValue = clamp(random(), 0, 1);
  const randomCurve = randomValue ** (1.8 - complexity * 0.4);
  const naturalDelay = minimumDelay + (maximumDelay - minimumDelay) * randomCurve;
  const maximumForClock = clockAwareMaximum(remainingMs, incrementMs);
  const minimumForClock = Math.min(minimumDelay, maximumForClock);
  let delay = clamp(naturalDelay, 350, maximumForClock);

  if (previousDelayMs !== null) {
    const availableRange = Math.max(0, maximumForClock - minimumForClock);
    const noticeableDifference = Math.min(900, availableRange / 3);
    if (Math.abs(delay - previousDelayMs) < noticeableDifference) {
      const laterDelay = previousDelayMs + noticeableDifference;
      const earlierDelay = previousDelayMs - noticeableDifference;
      delay = laterDelay <= maximumForClock
        ? laterDelay
        : clamp(earlierDelay, minimumForClock, maximumForClock);
    }
  }

  return Math.round(delay);
}
