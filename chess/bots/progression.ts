import { BOT_DIFFICULTIES } from "@/chess/bots/difficulties";

export const BOT_PROGRESSION_IDS = ["pawny", "knight", "bishop", "rook", "queen"] as const;
export const ALWAYS_UNLOCKED_BOT_IDS = ["pawny", "so-pawny"] as const;

export type BotProgressionState = {
  defeatedBotIds: string[];
  unlockedBotIds: string[];
};

const botNames = new Map(BOT_DIFFICULTIES.map((bot) => [bot.id, bot.name]));

export function getBotProgression(defeatedBotIds: Iterable<string>): BotProgressionState {
  const defeated = new Set(defeatedBotIds);
  const unlocked = new Set<string>(ALWAYS_UNLOCKED_BOT_IDS);

  for (let index = 1; index < BOT_PROGRESSION_IDS.length; index += 1) {
    if (!defeated.has(BOT_PROGRESSION_IDS[index - 1])) break;
    unlocked.add(BOT_PROGRESSION_IDS[index]);
  }

  return {
    defeatedBotIds: BOT_DIFFICULTIES.map((bot) => bot.id).filter((botId) => defeated.has(botId)),
    unlockedBotIds: BOT_DIFFICULTIES.map((bot) => bot.id).filter((botId) => unlocked.has(botId))
  };
}

export function isBotUnlocked(botId: string, unlockedBotIds: readonly string[]) {
  return unlockedBotIds.includes(botId);
}

export function getBotUnlockRequirement(botId: string) {
  const index = BOT_PROGRESSION_IDS.indexOf(botId as (typeof BOT_PROGRESSION_IDS)[number]);
  if (index <= 0) return null;
  const requiredBotId = BOT_PROGRESSION_IDS[index - 1];
  return {
    botId: requiredBotId,
    botName: botNames.get(requiredBotId) ?? "the previous bot"
  };
}
