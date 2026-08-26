import type { LiveGameStatus } from "@/chess/live/types";
import type { GameMove } from "@/chess/types";

export type LiveGameSound = "move" | "capture" | "check" | "end";

export type LiveGameSoundSnapshot = {
  id: string;
  status: LiveGameStatus;
  moves: Array<Pick<GameMove, "san">>;
};

export function liveGameSoundForUpdate(previous: LiveGameSoundSnapshot | null, next: LiveGameSoundSnapshot): LiveGameSound | null {
  if (!previous || previous.id !== next.id) return null;
  if (previous.status !== "completed" && next.status === "completed") return "end";
  if (next.moves.length <= previous.moves.length) return null;

  const san = next.moves.at(-1)?.san ?? "";
  if (san.includes("+") || san.includes("#")) return "check";
  if (san.includes("x")) return "capture";
  return "move";
}
