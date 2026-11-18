import type { PuzzleTournament } from "./tournament";

export function tournamentRoundClock(t: Pick<PuzzleTournament, "status" | "round" | "roundStartsAt" | "duration" | "matches">, now: number) {
  if (t.status === "cancelled") return { label: "Tournament cancelled", seconds: 0, running: false };
  if (t.status === "finished") return { label: "Tournament complete", seconds: 0, running: false };
  const pending = t.matches.some(m => m.round === t.round && !m.result);
  if (!pending) return { label: "Round complete", seconds: 0, running: false };
  if (t.roundStartsAt == null) return { label: "Round in progress", seconds: null, running: false };
  if (now < t.roundStartsAt) return { label: "Round starts in", seconds: Math.ceil((t.roundStartsAt - now) / 1000), running: true };
  const seconds = Math.max(0, Math.ceil((t.roundStartsAt + t.duration * 1000 - now) / 1000));
  return { label: seconds ? "Round time left" : "Time up · confirming results", seconds, running: seconds > 0 };
}
