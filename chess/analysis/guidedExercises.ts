const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const UCI = /^[a-h][1-8][a-h][1-8][qrbn]?$/;

export type GuidedAttemptInput = {
  chapterId: string;
  nodeId: string;
  move: { from: string; to: string; promotion?: "q" | "r" | "b" | "n" };
};

export type EnrichedGuidedAttempt = {
  id: string;
  studentId: string;
  studentName: string;
  chapterId: string;
  chapterTitle: string;
  nodeId: string;
  prompt: string;
  correct: boolean;
  attemptedAt: string;
};

export type GuidedExerciseProgress = {
  studentId: string;
  studentName: string;
  chapterId: string;
  chapterTitle: string;
  nodeId: string;
  prompt: string;
  totalAttempts: number;
  incorrectAttempts: number;
  solved: boolean;
  firstTrySolved: boolean;
  firstAttemptAt: string;
  lastAttemptAt: string;
};

export function parseGuidedAttemptInput(input: unknown): GuidedAttemptInput {
  const value = input && typeof input === "object" ? input as Record<string, unknown> : {};
  const chapterId = String(value.chapterId ?? "");
  const nodeId = String(value.nodeId ?? "");
  const moveValue = value.move && typeof value.move === "object" ? value.move as Record<string, unknown> : {};
  const from = String(moveValue.from ?? "");
  const to = String(moveValue.to ?? "");
  const promotion = moveValue.promotion === undefined ? undefined : String(moveValue.promotion);
  const uci = `${from}${to}${promotion ?? ""}`;
  if (!UUID.test(chapterId)) throw new Error("Invalid guided exercise chapter.");
  if (!nodeId || nodeId.length > 200) throw new Error("Invalid guided exercise position.");
  if (!UCI.test(uci)) throw new Error("Invalid guided exercise move.");
  return { chapterId, nodeId, move: { from, to, promotion: promotion as GuidedAttemptInput["move"]["promotion"] } };
}

export function aggregateGuidedAttempts(rows: EnrichedGuidedAttempt[]): GuidedExerciseProgress[] {
  const groups = new Map<string, EnrichedGuidedAttempt[]>();
  for (const row of rows) {
    const key = `${row.studentId}:${row.chapterId}:${row.nodeId}`;
    groups.set(key, [...groups.get(key) ?? [], row]);
  }
  return Array.from(groups.values()).map((attempts) => {
    const ordered = [...attempts].sort((left, right) => left.attemptedAt.localeCompare(right.attemptedAt));
    const first = ordered[0];
    const last = ordered.at(-1)!;
    return {
      studentId: first.studentId,
      studentName: first.studentName,
      chapterId: first.chapterId,
      chapterTitle: first.chapterTitle,
      nodeId: first.nodeId,
      prompt: last.prompt,
      totalAttempts: ordered.length,
      incorrectAttempts: ordered.filter((attempt) => !attempt.correct).length,
      solved: ordered.some((attempt) => attempt.correct),
      firstTrySolved: ordered.length > 0 && ordered[0].correct,
      firstAttemptAt: first.attemptedAt,
      lastAttemptAt: last.attemptedAt
    };
  }).sort((left, right) => right.lastAttemptAt.localeCompare(left.lastAttemptAt));
}
