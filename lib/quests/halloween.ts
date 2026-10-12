export const HALLOWEEN_QUEST_ID = "halloween-2026-bot-quest";
export const HALLOWEEN_QUEST_TITLE = "Halloween Bot Hunt";
export const HALLOWEEN_START = "2026-10-11T00:00:00+07:00";
// Exclusive boundary: November 1 is included in full, in the Academy time zone.
export const HALLOWEEN_END = "2026-11-02T00:00:00+07:00";
export const HALLOWEEN_DEADLINE_LABEL = "November 1, 2026 · 11:59 PM Bangkok time";
export const HALLOWEEN_REWARD = 500;
export const HALLOWEEN_BOTS = [
  { id: "halloween-2026-pumpkin", name: "Pipkin Pumpkin", title: "Pumpkin Pawn", rating: 400, portrait: "/bots/halloween/pumpkin.webp", description: "A cheerful pumpkin who loves pawn adventures. Watch for loose pieces!" },
  { id: "halloween-2026-ghost", name: "Boo the Ghost", title: "Ghost Knight", rating: 600, portrait: "/bots/halloween/ghost.webp", description: "Boo hops into surprising checks. Look twice before chasing this ghost." },
  { id: "halloween-2026-vampire", name: "Count Checkula", title: "Vampire Bishop", rating: 800, portrait: "/bots/halloween/vampire.webp", description: "The Count keeps an eye on every diagonal. Develop your pieces and guard your king." },
  { id: "halloween-2026-witch", name: "Mira Moonwitch", title: "Moonlight Queen", rating: 1000, portrait: "/bots/halloween/witch.webp", description: "Mira weaves patient plans. Calculate her reply before casting your next move." },
  { id: "halloween-2026-werewolf", name: "Grim the Werewolf", title: "Moonlit Challenger", rating: 1200, portrait: "/bots/halloween/werewolf.webp", description: "Grim is friendly, but his tactics have teeth. Bring your best board vision!" }
] as const;

export function isHalloweenBot(id: string) {
  return HALLOWEEN_BOTS.some((bot) => bot.id === id);
}

export function halloweenQuestState(completed: boolean, now = Date.now()) {
  if (completed) return "completed" as const;
  if (now < Date.parse(HALLOWEEN_START)) return "upcoming" as const;
  return now < Date.parse(HALLOWEEN_END) ? "active" as const : "expired" as const;
}

export type HalloweenQuestProgress = {
  enabled: boolean;
  defeatedBotIds: string[];
  completed: boolean;
  completedAt: string | null;
};
