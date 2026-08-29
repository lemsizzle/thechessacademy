import "server-only";

import { getBotProgression, getBotUnlockRequirement, isBotUnlocked } from "@/chess/bots/progression";
import { getSupabaseServiceClient } from "@/lib/supabase/server";

type ComputerWinRow = {
  opponent_id: string | null;
};

export class BotLockedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BotLockedError";
  }
}

export async function getStudentBotProgression(studentId: string) {
  const client = getSupabaseServiceClient();
  if (!client) throw new Error("Computer opponent progression is not configured.");

  const { data, error } = await client
    .from("internal_chess_games")
    .select("opponent_id")
    .eq("player_id", studentId)
    .eq("opponent_type", "computer")
    .eq("result", "win");

  if (error) throw new Error(error.message);
  return getBotProgression(((data ?? []) as ComputerWinRow[]).flatMap((row) => row.opponent_id ? [row.opponent_id] : []));
}

export async function requireStudentBotUnlocked(studentId: string, botId: string) {
  const progression = await getStudentBotProgression(studentId);
  if (isBotUnlocked(botId, progression.unlockedBotIds)) return progression;

  const requirement = getBotUnlockRequirement(botId);
  throw new BotLockedError(requirement
    ? `Defeat ${requirement.botName} to unlock this opponent.`
    : "This computer opponent is locked.");
}
