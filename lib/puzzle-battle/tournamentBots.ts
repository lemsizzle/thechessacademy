import "server-only";
import { randomInt } from "node:crypto";
import type { BattleChallenge, BattleMode } from "./types";
import type { BotEvent } from "./botPlan";

export function ratedBotParameters(elo: number) {
  if (!Number.isInteger(elo) || elo < 200 || elo > 2400) throw new Error("Bot Elo must be between 200 and 2400.");
  return { pace: Math.max(0.3, 1.6 * Math.pow(0.625, (elo - 600) / 400)), accuracy: Math.min(0.99, Math.max(0.5, 0.72 + (elo - 600) * 0.0003)) };
}
export function buildRatedBotPlan(deck: BattleChallenge[], elo: number, random = () => randomInt(0, 1_000_000) / 1_000_000): BotEvent[] {
  const { pace, accuracy } = ratedBotParameters(elo);
  let atMs = 0;
  return deck.map(c => {
    const base = c.kind === "hide-and-seek" ? 6000 + c.puzzle.safeSquares.length * 1100
      : c.kind === "star-wars" ? 4000 + c.puzzle.stars.length * 2200
      : 7000 + Math.max(0, (c.puzzle.rating ?? 800) - 500) * 6 + Math.ceil(c.puzzle.moves.length / 2) * 2200;
    const solved = random() < accuracy;
    atMs += Math.round(Math.max(6000, base * pace * (0.85 + random() * 0.3) * (solved ? 1 : 0.75)));
    return { atMs, solved };
  });
}

/** Precommit bot-v-bot results privately; reveal only when that match ends. */
export function simulateTournamentBots(mode: BattleMode, duration: number, plans: [BotEvent[], BotEvent[]]) {
  const score = [0,0], mistakes = [0,0], done = [false,false];
  const events = plans.flatMap((p, slot) => p.map((e, index) => ({ ...e, slot, last: index === p.length-1 }))).sort((a,b) => a.atMs-b.atMs);
  for (let i = 0; i < events.length;) {
    const at = events[i].atMs;
    if (at >= duration * 1000) break;
    const batch = events.filter(e => e.atMs === at && !done[e.slot]);
    while (i < events.length && events[i].atMs === at) i++;
    for (const e of batch) {
      score[e.slot] += Number(e.solved); mistakes[e.slot] += Number(!e.solved);
      done[e.slot] = e.last || mistakes[e.slot] >= 3 || mode === "hide-and-seek";
    }
    if (mode === "hide-and-seek" && batch.length) {
      const winners = batch.map(e => e.solved ? e.slot : 1-e.slot);
      return { score, winnerSlot: winners.every(w => w === winners[0]) ? winners[0] : null, afterMs: at };
    }
    if (done.every(Boolean)) return { score, winnerSlot: score[0] === score[1] ? null : score[0] > score[1] ? 0 : 1, afterMs: at };
  }
  return { score, winnerSlot: score[0] === score[1] ? null : score[0] > score[1] ? 0 : 1, afterMs: duration * 1000 };
}
