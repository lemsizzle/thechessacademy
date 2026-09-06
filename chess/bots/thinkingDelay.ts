import { Chess } from "chess.js";
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

function positionDecisionComplexity(fen: string) {
  const chess = new Chess(fen);
  const legalMoveCount = chess.moves().length;
  const pieceCount = chess.board().flat().filter(Boolean).length;
  const tacticalComplexity = estimatePositionComplexity(fen);
  const choiceBreadth = clamp((legalMoveCount - 2) / 28, 0, 1);
  const materialRichness = clamp((pieceCount - 4) / 20, 0, 1);

  // Tactical positions feel difficult only when the bot also has meaningful
  // choices to compare. This keeps forced replies and sparse endgames brisk.
  const decisionComplexity = (
    tacticalComplexity * 0.55
    + choiceBreadth * 0.35
    + materialRichness * 0.1
  ) * (0.3 + choiceBreadth * 0.7) * (0.35 + materialRichness * 0.65);

  return {
    complexity: clamp(decisionComplexity, 0, 1),
    legalMoveCount,
    pieceCount
  };
}

function choiceAwareMaximum(legalMoveCount: number, pieceCount: number) {
  if (legalMoveCount <= 1) return 750;
  if (legalMoveCount <= 3) return 1_000;
  if (legalMoveCount <= 6) return 1_600;
  if (legalMoveCount <= 10) return 2_500;
  if (pieceCount <= 8 && legalMoveCount <= 14) return 4_000;
  return MAX_BOT_THINKING_DELAY_MS;
}

export function createBotThinkingDelay({
  fen,
  remainingMs,
  incrementMs,
  previousDelayMs = null,
  random = Math.random
}: BotThinkingDelayOptions) {
  const { complexity, legalMoveCount, pieceCount } = positionDecisionComplexity(fen);
  const complexityCurve = complexity ** 1.15;
  const minimumDelay = 500 + complexityCurve * 3_500;
  const maximumDelay = 1_600 + complexityCurve * (MAX_BOT_THINKING_DELAY_MS - 1_600);
  const randomValue = clamp(random(), 0, 1);
  const randomCurve = randomValue ** (1.8 - complexity * 0.4);
  const maximumAllowed = Math.min(
    maximumDelay,
    choiceAwareMaximum(legalMoveCount, pieceCount),
    clockAwareMaximum(remainingMs, incrementMs)
  );
  const minimumAllowed = Math.min(minimumDelay, maximumAllowed);
  const naturalDelay = minimumAllowed + (maximumAllowed - minimumAllowed) * randomCurve;
  let delay = clamp(naturalDelay, 350, maximumAllowed);

  if (previousDelayMs !== null) {
    const availableRange = Math.max(0, maximumAllowed - minimumAllowed);
    const noticeableDifference = Math.min(900, availableRange / 3);
    if (Math.abs(delay - previousDelayMs) < noticeableDifference) {
      const laterDelay = previousDelayMs + noticeableDifference;
      const earlierDelay = previousDelayMs - noticeableDifference;
      delay = laterDelay <= maximumAllowed
        ? laterDelay
        : clamp(earlierDelay, minimumAllowed, maximumAllowed);
    }
  }

  return Math.round(delay);
}
