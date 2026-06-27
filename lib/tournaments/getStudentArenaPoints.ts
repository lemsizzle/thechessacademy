import type { ArenaTournamentResult, StudentLichessAccount } from "@/lib/types";

export function getStudentArenaPoints(account: StudentLichessAccount | undefined, results: ArenaTournamentResult[]) {
  if (!account) return { totalPoints: 0, tournamentsPlayed: 0 };
  const baseline = new Date(account.activityBaselineSetAt ?? account.linkedAt ?? account.createdAt).getTime();
  if (Number.isNaN(baseline)) return { totalPoints: 0, tournamentsPlayed: 0 };

  const eligible = results.filter((result) => {
    if (result.studentId !== account.studentId || !result.tournamentStartsAt) return false;
    const startsAt = new Date(result.tournamentStartsAt).getTime();
    return !Number.isNaN(startsAt) && startsAt >= baseline;
  });

  return {
    totalPoints: eligible.reduce((total, result) => total + Math.max(0, result.score), 0),
    tournamentsPlayed: new Set(eligible.map((result) => result.lichessTournamentId)).size
  };
}
