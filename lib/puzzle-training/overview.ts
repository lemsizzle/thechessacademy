import type { SurvivalLeaderboardScore } from "@/lib/leaderboard/survival";
import type { PuzzleThemeSlug } from "@/lib/puzzle-training/types";

export type WoodpeckerCycleOverview = {
  puzzlesPerMinute: number;
  accuracy: number;
  setSize: number;
  theme: PuzzleThemeSlug;
  completedAt: string;
};

export type PuzzleTrainingOverview = {
  survival: Pick<SurvivalLeaderboardScore, "weekScore" | "monthScore" | "allTimeScore">;
  latestWoodpeckerCycle: WoodpeckerCycleOverview | null;
};

export const emptyPuzzleTrainingOverview: PuzzleTrainingOverview = {
  survival: { weekScore: 0, monthScore: 0, allTimeScore: 0 },
  latestWoodpeckerCycle: null
};
