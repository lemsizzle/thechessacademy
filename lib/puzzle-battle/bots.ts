export const BATTLE_BOT_LEVELS = ["gentle", "steady", "swift"] as const;
export type BattleBotLevel = (typeof BATTLE_BOT_LEVELS)[number];
export const BATTLE_BOTS: Record<BattleBotLevel, { name: string; description: string }> = {
  gentle: { name: "Gentle", description: "A relaxed pace with more mistakes. Great for your first race." },
  steady: { name: "Steady", description: "A quicker, more accurate practice partner." },
  swift: { name: "Swift", description: "Fast and focused. A challenge for confident solvers." },
};
