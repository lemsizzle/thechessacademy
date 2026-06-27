import type { StudentGameSubmission } from "@/lib/types";
import { validateLichessGameUrl } from "@/lib/submissions/validateLichessGameUrl";

export function createGameSubmission(input: Omit<StudentGameSubmission, "id" | "platform" | "lichessGameId" | "status" | "submittedAt">) {
  const parsed = validateLichessGameUrl(input.gameUrl);
  if (!parsed.ok) return { ok: false as const, error: parsed.error };

  const submission: StudentGameSubmission = {
    ...input,
    id: `student-game-${input.studentId}-${Date.now()}`,
    gameUrl: parsed.url,
    platform: "lichess",
    lichessGameId: parsed.gameId,
    status: "pending",
    submittedAt: new Date().toISOString().slice(0, 10)
  };
  return { ok: true as const, submission };
}
