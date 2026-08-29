import "server-only";

import { getBotProgression, getBotUnlockRequirement, isBotUnlocked } from "@/chess/bots/progression";
import { getSupabaseServiceClient } from "@/lib/supabase/server";

type BotDefeatRow = {
  bot_id: string | null;
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
    .from("student_bot_defeats")
    .select("bot_id")
    .eq("student_id", studentId);

  if (error) throw new Error(error.message);
  return getBotProgression(((data ?? []) as BotDefeatRow[]).flatMap((row) => row.bot_id ? [row.bot_id] : []));
}

export async function requireStudentBotUnlocked(studentId: string, botId: string) {
  const progression = await getStudentBotProgression(studentId);
  if (isBotUnlocked(botId, progression.unlockedBotIds)) return progression;

  const requirement = getBotUnlockRequirement(botId);
  throw new BotLockedError(requirement
    ? `Defeat ${requirement.botName} to unlock this opponent.`
    : "This computer opponent is locked.");
}
