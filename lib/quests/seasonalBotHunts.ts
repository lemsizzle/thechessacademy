import { HALLOWEEN_BOTS, HALLOWEEN_START, HALLOWEEN_END, HALLOWEEN_QUEST_ID, HALLOWEEN_QUEST_TITLE, HALLOWEEN_DEADLINE_LABEL } from "./halloween";

export type SeasonalBot = { id: string; name: string; title: string; rating: number; portrait: string; description: string };
export type SeasonalBotHunt = {
  id: string; title: string; label: string; startsAt: string; endsAt: string;
  deadlineLabel: string; adaptationStartsAt: string; completionPrefix: string;
  reward: number; bots: readonly SeasonalBot[];
  // Retire opponents from Play independently of saved quest/badge history.
  hideBotsAt?: string;
  badge?: { id: string; name: string; image: string };
};
export const THANKSGIVING_HUNT: SeasonalBotHunt = {
  id: "thanksgiving-2026-bot-quest", title: "Thanksgiving Bot Hunt", label: "Thanksgiving",
  startsAt: "2026-11-01T00:00:00+07:00",
  // Includes the day after U.S. Thanksgiving (Nov 26), through Friday in Pacific time.
  endsAt: "2026-11-28T00:00:00-08:00",
  deadlineLabel: "November 27, 2026 · 11:59 PM Pacific (November 28 · 2:59 PM Bangkok)",
  adaptationStartsAt: "2026-11-01T00:00:00+07:00", completionPrefix: "seasonal:thanksgiving-2026:", reward: 500,
  badge: { id: "e7261127-0000-4000-8000-000000000001", name: "Harvest Champion", image: "/badges/seasonal/harvest-champion.webp" },
  bots: [
    { id: "thanksgiving-2026-turkey", name: "Tilly Turkey", title: "Thankful Pawn", rating: 400, portrait: "/bots/thanksgiving/turkey.webp", description: "Tilly brings plenty of cheer and a few loose pieces. Look for safe captures!" },
    { id: "thanksgiving-2026-corn", name: "Kernel Corn", title: "Golden Knight", rating: 550, portrait: "/bots/thanksgiving/corn.webp", description: "Kernel pops up with surprising knight forks. Check what each jump attacks." },
    { id: "thanksgiving-2026-fox", name: "Maple Fox", title: "Autumn Bishop", rating: 700, portrait: "/bots/thanksgiving/fox.webp", description: "Maple watches the long diagonals. Develop your pieces and keep them protected." },
    { id: "thanksgiving-2026-scarecrow", name: "Hazel Harvest", title: "Harvest Rook", rating: 850, portrait: "/bots/thanksgiving/scarecrow.webp", description: "Hazel guards the harvest with patient plans. Find an open file for your rooks." },
    { id: "thanksgiving-2026-stag", name: "King Chestnut", title: "Harvest King", rating: 1000, portrait: "/bots/thanksgiving/stag.webp", description: "Chestnut is a kind king with sharp tactics. Calculate his strongest reply before you move." }
  ]
};
export const HALLOWEEN_HUNT: SeasonalBotHunt = {
  id: HALLOWEEN_QUEST_ID, title: HALLOWEEN_QUEST_TITLE, label: "Halloween",
  startsAt: HALLOWEEN_START, endsAt: HALLOWEEN_END, deadlineLabel: HALLOWEEN_DEADLINE_LABEL,
  hideBotsAt: THANKSGIVING_HUNT.startsAt,
  adaptationStartsAt: "2026-10-26T00:00:00+07:00", completionPrefix: "halloween-2026:", reward: 500, bots: HALLOWEEN_BOTS
};
// Add future holidays here and seed their matching seasonal_bot_hunts DB row.
// IDs stay stable so expired events retain their history and earned badges.
export const SEASONAL_BOT_HUNTS: readonly SeasonalBotHunt[] = [HALLOWEEN_HUNT, THANKSGIVING_HUNT];
export const SEASONAL_BOTS = SEASONAL_BOT_HUNTS.flatMap((hunt) => hunt.bots);
export function huntForBot(id: string) { return SEASONAL_BOT_HUNTS.find((hunt) => hunt.bots.some((bot) => bot.id === id)); }
export function isSeasonalBot(id: string) { return Boolean(huntForBot(id)); }
export function isSeasonalQuest(id: string) { return SEASONAL_BOT_HUNTS.some((hunt) => hunt.id === id); }
export function isSeasonalRecordId(id: string) { return id.startsWith("seasonal:") || id.startsWith("halloween-2026:"); }
export function seasonalBotsVisible(hunt: SeasonalBotHunt, now = Date.now()) {
  return now < Date.parse(hunt.hideBotsAt ?? hunt.endsAt) && now < Date.parse(hunt.endsAt);
}
export function seasonalQuestState(hunt: SeasonalBotHunt, completed: boolean, now = Date.now()) {
  if (completed) return "completed" as const;
  if (now < Date.parse(hunt.startsAt)) return "upcoming" as const;
  return now < Date.parse(hunt.endsAt) ? "active" as const : "expired" as const;
}
export type SeasonalQuestProgress = { enabled: boolean; defeatedBotIds: string[]; completed: boolean; completedAt: string | null };
