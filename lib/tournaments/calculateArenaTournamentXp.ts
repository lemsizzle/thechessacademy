export const ARENA_XP_RULES = {
  participation: 25,
  perPoint: 5,
  topThreeBonus: 50,
  weeklyCap: 300
} as const;

export function calculateArenaTournamentXp(score: number, rank: number, approvedThisWeek = 0) {
  const participationXp = ARENA_XP_RULES.participation;
  const scoreXp = Math.max(0, score) * ARENA_XP_RULES.perPoint;
  const placementXp = rank > 0 && rank <= 3 ? ARENA_XP_RULES.topThreeBonus : 0;
  const uncapped = participationXp + scoreXp + placementXp;
  const remaining = Math.max(0, ARENA_XP_RULES.weeklyCap - approvedThisWeek);
  return {
    participationXp,
    scoreXp,
    placementXp,
    totalXp: Math.min(uncapped, remaining),
    capped: uncapped > remaining
  };
}
