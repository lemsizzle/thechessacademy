import { describe, expect, it } from "vitest";
import { buildBotPlan } from "@/lib/puzzle-battle/botPlan";
import { generateStarWarsPuzzle } from "@/lib/puzzle-training/starWars";
import { generateHideAndSeekBoard } from "@/lib/puzzle-training/hideAndSeek";
import type { BattleChallenge } from "@/lib/puzzle-battle/types";

const deck: BattleChallenge[] = [
  { kind: "star-wars", puzzle: generateStarWarsPuzzle(0, 1234) },
  { kind: "hide-and-seek", puzzle: generateHideAndSeekBoard("bot-test") },
];
describe("computer battle pacing", () => {
  it("paces every shared board, with harder levels faster and no instant events", () => {
    const plans = ["gentle", "steady", "swift"].map(level =>
      buildBotPlan(deck, level as "gentle" | "steady" | "swift", () => 0.5));
    for (const plan of plans) {
      expect(plan).toHaveLength(deck.length);
      expect(plan[0].atMs).toBeGreaterThanOrEqual(6000);
      expect(plan[1].atMs - plan[0].atMs).toBeGreaterThanOrEqual(6000);
    }
    expect(plans[0][1].atMs).toBeGreaterThan(plans[1][1].atMs);
    expect(plans[1][1].atMs).toBeGreaterThan(plans[2][1].atMs);
  });
  it("allows mistakes and improves accuracy with difficulty", () => {
    expect(buildBotPlan(deck, "gentle", () => 0.8)[0].solved).toBe(false);
    expect(buildBotPlan(deck, "steady", () => 0.8)[0].solved).toBe(true);
    expect(buildBotPlan(deck, "steady", () => 0.9)[0].solved).toBe(false);
    expect(buildBotPlan(deck, "swift", () => 0.9)[0].solved).toBe(true);
    expect(buildBotPlan(deck, "swift", () => 0.99)[0].solved).toBe(false);
  });
});
