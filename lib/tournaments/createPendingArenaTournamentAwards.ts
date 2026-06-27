import { calculateArenaTournamentXp } from "@/lib/tournaments/calculateArenaTournamentXp";
import type { ArenaTournamentResult, PendingTournamentAward, Tournament } from "@/lib/types";

export function createPendingArenaTournamentAwards(
  tournament: Tournament,
  results: ArenaTournamentResult[],
  existing: PendingTournamentAward[]
) {
  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  weekStart.setHours(0, 0, 0, 0);
  let approvedThisWeek = existing
    .filter((award) => award.status !== "rejected" && new Date(award.reviewedAt ?? award.createdAt) >= weekStart)
    .reduce((total, award) => total + award.xpAmount, 0);

  return results.flatMap((result) => {
    if (!result.studentId || !result.matched) return [];
    const duplicate = existing.some((award) => award.studentId === result.studentId && award.lichessTournamentId === result.lichessTournamentId);
    if (duplicate) return [];
    const xp = calculateArenaTournamentXp(result.score, result.rank, approvedThisWeek);
    approvedThisWeek += xp.totalXp;
    return [{
      id: `tournament-award-${result.lichessTournamentId}-${result.studentId}`,
      studentId: result.studentId,
      tournamentId: tournament.id,
      lichessTournamentId: result.lichessTournamentId,
      lichessUsername: result.lichessUsername,
      title: tournament.name,
      description: `Arena participation with ${result.score} points and rank ${result.rank}.`,
      xpAmount: xp.totalXp,
      reason: `${xp.participationXp} participation + ${xp.scoreXp} score XP${xp.placementXp ? ` + ${xp.placementXp} top 3 bonus` : ""}`,
      tournamentSource: tournament.source,
      status: "pending" as const,
      createdAt: new Date().toISOString()
    }];
  });
}
