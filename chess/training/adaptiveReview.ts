export type AdaptiveReviewOutcome = "correct" | "incorrect" | "revealed";
export type AdaptiveReviewStatus = "learning" | "review" | "mastered";

export type AdaptiveReviewSchedule = {
  repetitions: number;
  intervalDays: number;
  status: AdaptiveReviewStatus;
  lapses: number;
};

export function nextAdaptiveReviewSchedule(
  current: AdaptiveReviewSchedule,
  outcome: AdaptiveReviewOutcome
): AdaptiveReviewSchedule {
  if (outcome !== "correct") {
    return {
      repetitions: 0,
      intervalDays: 0,
      status: "learning",
      lapses: current.lapses + 1
    };
  }

  const repetitions = current.repetitions + 1;
  const intervalDays = repetitions === 1
    ? 1
    : repetitions === 2
      ? 3
      : repetitions === 3
        ? 7
        : repetitions === 4
          ? 14
          : Math.min(180, Math.max(15, Math.round(current.intervalDays * 2.2)));
  return {
    repetitions,
    intervalDays,
    status: repetitions >= 4 ? "mastered" : "review",
    lapses: current.lapses
  };
}

export function adaptiveReviewDelayMs(outcome: AdaptiveReviewOutcome, intervalDays: number) {
  if (outcome === "incorrect") return 10 * 60 * 1000;
  if (outcome === "revealed") return 24 * 60 * 60 * 1000;
  return intervalDays * 24 * 60 * 60 * 1000;
}
