import "server-only";
import { randomInt } from "node:crypto";
import type { BattleChallenge } from "./types";
import type { BattleBotLevel } from "./bots";

export type BotEvent = { atMs: number; solved: boolean };
// Private, precommitted practice pace. Never sent to the browser or regenerated
// on reads. Both opponents advance through the same persisted challenge deck.
export function buildBotPlan(deck: BattleChallenge[], level: BattleBotLevel,
  random = () => randomInt(0, 1_000_000) / 1_000_000): BotEvent[] {
  const pace = { gentle: 1.6, steady: 1, swift: 0.65 }[level];
  const accuracy = { gentle: 0.72, steady: 0.86, swift: 0.95 }[level];
  let elapsed = 0;
  return deck.map((challenge) => {
    const base = challenge.kind === "hide-and-seek"
      ? 6000 + challenge.puzzle.safeSquares.length * 1100
      : challenge.kind === "star-wars"
        ? 4000 + challenge.puzzle.stars.length * 2200
        : 7000 + Math.max(0, (challenge.puzzle.rating ?? 800) - 500) * 6
          + Math.ceil(challenge.puzzle.moves.length / 2) * 2200;
    const solved = random() < accuracy;
    const thinking = base * pace * (0.85 + random() * 0.3);
    elapsed += Math.round(Math.max(6000, thinking * (solved ? 1 : 0.75)));
    return { atMs: elapsed, solved };
  });
}
