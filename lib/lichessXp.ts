import type { Student, StudentLichessAccount } from "@/lib/types";

export const LICHESS_XP_RULES = {
  ratingFloor: 800,
  ratingStep: 100,
  competitiveRatingXpPerStep: 15,
  puzzleRatingXpPerStep: 10,
  maximumRatingSteps: 12,
  rapidGamePlayedXp: 5,
  rapidGameWonXp: 10,
  blitzGamePlayedXp: 2,
  blitzGameWonXp: 5,
  puzzleCorrectXp: 5
};

function ratingMilestoneXp(rating: number | null | undefined, xpPerStep: number) {
  if (!rating) return 0;
  const steps = Math.min(
    LICHESS_XP_RULES.maximumRatingSteps,
    Math.max(0, Math.floor((rating - LICHESS_XP_RULES.ratingFloor) / LICHESS_XP_RULES.ratingStep))
  );
  return steps * xpPerStep;
}

function highestRating(...ratings: Array<number | null | undefined>) {
  const valid = ratings.filter((rating): rating is number => typeof rating === "number" && rating > 0);
  return valid.length ? Math.max(...valid) : undefined;
}

function countSinceBaseline(current = 0, baseline?: number) {
  return Math.max(0, current - (baseline ?? current));
}

function xpSinceRatingBaseline(currentPeak: number | undefined, baseline: number | undefined, xpPerStep: number) {
  return Math.max(0, ratingMilestoneXp(currentPeak, xpPerStep) - ratingMilestoneXp(baseline, xpPerStep));
}

export function withLichessActivityBaseline(account: StudentLichessAccount, previous?: StudentLichessAccount): StudentLichessAccount {
  const currentBlitzRating = account.blitzProvisional ? undefined : account.blitzRating ?? undefined;
  const currentRapidRating = account.rapidProvisional ? undefined : account.rapidRating ?? undefined;
  const currentPuzzleRating = account.puzzleRating ?? undefined;
  const previousBaseline = previous?.syncStatus === "mock" && account.syncStatus === "connected" ? undefined : previous;

  return {
    ...account,
    blitzWins: account.blitzWins ?? previousBaseline?.blitzWins ?? 0,
    rapidWins: account.rapidWins ?? previousBaseline?.rapidWins ?? 0,
    puzzleCorrect: account.puzzleCorrect ?? previousBaseline?.puzzleCorrect ?? 0,
    linkedAt: previousBaseline?.linkedAt ?? account.linkedAt,
    baselineBlitzGames: previousBaseline?.baselineBlitzGames ?? previousBaseline?.blitzGames ?? account.blitzGames,
    baselineRapidGames: previousBaseline?.baselineRapidGames ?? previousBaseline?.rapidGames ?? account.rapidGames,
    baselinePuzzleGames: previousBaseline?.baselinePuzzleGames ?? previousBaseline?.puzzleGames ?? account.puzzleGames ?? 0,
    baselineBlitzWins: previousBaseline?.baselineBlitzWins ?? 0,
    baselineRapidWins: previousBaseline?.baselineRapidWins ?? 0,
    baselinePuzzleCorrect: previousBaseline?.baselinePuzzleCorrect ?? 0,
    baselineBlitzRating: previousBaseline?.baselineBlitzRating ?? previousBaseline?.peakBlitzRating ?? highestRating(previousBaseline?.blitzProvisional ? undefined : previousBaseline?.blitzRating, currentBlitzRating),
    baselineRapidRating: previousBaseline?.baselineRapidRating ?? previousBaseline?.peakRapidRating ?? highestRating(previousBaseline?.rapidProvisional ? undefined : previousBaseline?.rapidRating, currentRapidRating),
    baselinePuzzleRating: previousBaseline?.baselinePuzzleRating ?? previousBaseline?.peakPuzzleRating ?? highestRating(previousBaseline?.puzzleRating, currentPuzzleRating),
    peakBlitzRating: highestRating(
      previousBaseline?.peakBlitzRating,
      previousBaseline?.blitzProvisional ? undefined : previousBaseline?.blitzRating,
      currentBlitzRating
    ),
    peakRapidRating: highestRating(
      previousBaseline?.peakRapidRating,
      previousBaseline?.rapidProvisional ? undefined : previousBaseline?.rapidRating,
      currentRapidRating
    ),
    peakPuzzleRating: highestRating(previousBaseline?.peakPuzzleRating, previousBaseline?.puzzleRating, currentPuzzleRating),
    activityBaselineSetAt: previousBaseline?.activityBaselineSetAt ?? previousBaseline?.linkedAt ?? account.linkedAt,
    createdAt: previousBaseline?.createdAt ?? account.createdAt
  };
}

export function getLichessXpBreakdown(account?: StudentLichessAccount) {
  const blitzPeak = highestRating(account?.peakBlitzRating, account?.blitzProvisional ? undefined : account?.blitzRating);
  const rapidPeak = highestRating(account?.peakRapidRating, account?.rapidProvisional ? undefined : account?.rapidRating);
  const puzzlePeak = highestRating(account?.peakPuzzleRating, account?.puzzleRating);
  const baselineBlitzRating = account?.baselineBlitzRating ?? blitzPeak;
  const baselineRapidRating = account?.baselineRapidRating ?? rapidPeak;
  const baselinePuzzleRating = account?.baselinePuzzleRating ?? puzzlePeak;
  const blitzRatingXp = xpSinceRatingBaseline(blitzPeak, baselineBlitzRating, LICHESS_XP_RULES.competitiveRatingXpPerStep);
  const rapidRatingXp = xpSinceRatingBaseline(rapidPeak, baselineRapidRating, LICHESS_XP_RULES.competitiveRatingXpPerStep);
  const puzzleRatingXp = xpSinceRatingBaseline(puzzlePeak, baselinePuzzleRating, LICHESS_XP_RULES.puzzleRatingXpPerStep);
  const blitzGamesAfterLogin = countSinceBaseline(account?.blitzGames, account?.baselineBlitzGames);
  const rapidGamesAfterLogin = countSinceBaseline(account?.rapidGames, account?.baselineRapidGames);
  const blitzWinsAfterLogin = countSinceBaseline(account?.blitzWins, account?.baselineBlitzWins);
  const rapidWinsAfterLogin = countSinceBaseline(account?.rapidWins, account?.baselineRapidWins);
  const puzzlesAfterLogin = countSinceBaseline(account?.puzzleGames, account?.baselinePuzzleGames);
  const puzzleCorrectAfterLogin = countSinceBaseline(account?.puzzleCorrect ?? account?.puzzleGames, account?.baselinePuzzleCorrect ?? account?.baselinePuzzleGames);
  const ratedGamesAfterLogin = blitzGamesAfterLogin + rapidGamesAfterLogin;
  const blitzGameXp = blitzGamesAfterLogin * LICHESS_XP_RULES.blitzGamePlayedXp;
  const blitzWinXp = blitzWinsAfterLogin * Math.max(0, LICHESS_XP_RULES.blitzGameWonXp - LICHESS_XP_RULES.blitzGamePlayedXp);
  const rapidGameXp = rapidGamesAfterLogin * LICHESS_XP_RULES.rapidGamePlayedXp;
  const rapidWinXp = rapidWinsAfterLogin * Math.max(0, LICHESS_XP_RULES.rapidGameWonXp - LICHESS_XP_RULES.rapidGamePlayedXp);
  const ratedGameXp = rapidGameXp + rapidWinXp + blitzGameXp + blitzWinXp;
  const puzzleActivityXp = puzzleCorrectAfterLogin * LICHESS_XP_RULES.puzzleCorrectXp;
  const ratingXp = blitzRatingXp + rapidRatingXp + puzzleRatingXp;
  const activityXp = ratedGameXp + puzzleActivityXp;

  return {
    blitzRatingXp,
    rapidRatingXp,
    puzzleRatingXp,
    blitzPeak,
    rapidPeak,
    puzzlePeak,
    ratingXp,
    blitzGamesAfterLogin,
    rapidGamesAfterLogin,
    blitzWinsAfterLogin,
    rapidWinsAfterLogin,
    ratedGamesAfterLogin,
    puzzlesAfterLogin,
    puzzleCorrectAfterLogin,
    blitzGameXp,
    blitzWinXp,
    rapidGameXp,
    rapidWinXp,
    ratedGameXp,
    puzzleActivityXp,
    activityXp,
    total: ratingXp + activityXp
  };
}

export function getStudentXpWithLichess(student: Student, account?: StudentLichessAccount) {
  const lichess = getLichessXpBreakdown(account);
  return {
    baseXp: student.totalXp,
    lichessXp: lichess.total,
    totalXp: student.totalXp + lichess.total,
    lichess
  };
}

export function findStudentLichessAccount(student: Student, accounts: StudentLichessAccount[]) {
  return accounts.find((account) => account.studentId === student.id);
}
