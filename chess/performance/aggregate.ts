import type {
  AdminChessPerformanceReport,
  PerformanceGameInput,
  PerformanceStudentInput,
  StudentChessPerformance
} from "@/chess/performance/types";

const ALL_CLASSES = "all";

function newStudentPerformance(student: PerformanceStudentInput): StudentChessPerformance {
  return {
    ...student,
    total: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    winRate: 0,
    computerGames: 0,
    liveGames: 0,
    lastPlayedAt: null,
    latestGameId: null,
    latestResult: null
  };
}

function gameKey(game: PerformanceGameInput) {
  return game.opponentType === "student" && game.sourceLiveGameId
    ? `live:${game.sourceLiveGameId}`
    : `game:${game.id}`;
}

export function buildAdminChessPerformance(
  students: PerformanceStudentInput[],
  games: PerformanceGameInput[],
  requestedClass = ALL_CLASSES,
  now = new Date()
): AdminChessPerformanceReport {
  const classes = [...new Set(students.map((student) => student.classGroup))]
    .filter(Boolean)
    .sort((left, right) => left.localeCompare(right));
  const selectedClass = requestedClass !== ALL_CLASSES && classes.includes(requestedClass)
    ? requestedClass
    : ALL_CLASSES;
  const visibleStudents = students.filter((student) => selectedClass === ALL_CLASSES || student.classGroup === selectedClass);
  const byStudent = new Map(visibleStudents.map((student) => [student.id, newStudentPerformance(student)]));
  const uniqueGames = new Map<string, PerformanceGameInput>();
  const thirtyDaysAgo = now.getTime() - 30 * 24 * 60 * 60 * 1000;

  for (const game of games) {
    const student = byStudent.get(game.playerId);
    if (!student) continue;

    student.total += 1;
    if (game.result === "win") student.wins += 1;
    else if (game.result === "draw") student.draws += 1;
    else student.losses += 1;
    if (game.opponentType === "computer") student.computerGames += 1;
    else student.liveGames += 1;

    const completedAt = Date.parse(game.completedAt);
    const previousCompletedAt = student.lastPlayedAt ? Date.parse(student.lastPlayedAt) : Number.NEGATIVE_INFINITY;
    if (Number.isFinite(completedAt) && completedAt > previousCompletedAt) {
      student.lastPlayedAt = game.completedAt;
      student.latestGameId = game.id;
      student.latestResult = game.result;
    }

    const key = gameKey(game);
    const existing = uniqueGames.get(key);
    if (!existing || Date.parse(game.completedAt) > Date.parse(existing.completedAt)) uniqueGames.set(key, game);
  }

  const roster = [...byStudent.values()]
    .map((student) => ({
      ...student,
      winRate: student.total > 0 ? Math.round((student.wins / student.total) * 100) : 0
    }))
    .sort((left, right) => {
      const leftTime = left.lastPlayedAt ? Date.parse(left.lastPlayedAt) : Number.NEGATIVE_INFINITY;
      const rightTime = right.lastPlayedAt ? Date.parse(right.lastPlayedAt) : Number.NEGATIVE_INFINITY;
      return rightTime - leftTime || left.name.localeCompare(right.name);
    });
  const unique = [...uniqueGames.values()];

  return {
    classes,
    selectedClass,
    summary: {
      students: roster.length,
      activePlayers: roster.filter((student) => student.total > 0).length,
      totalGames: unique.length,
      computerGames: unique.filter((game) => game.opponentType === "computer").length,
      liveGames: unique.filter((game) => game.opponentType === "student").length,
      gamesLast30Days: unique.filter((game) => Date.parse(game.completedAt) >= thirtyDaysAgo).length
    },
    students: roster
  };
}
