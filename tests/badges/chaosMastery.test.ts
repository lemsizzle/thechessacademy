import { describe, expect, it } from "vitest";
import { isChaosMastery } from "@/lib/badges/chaosMastery";
import { getTacticalMilestone, groupEarnedBadges } from "@/lib/badges/tacticalMilestones";
import type { Badge } from "@/lib/types";

const badges = ["Bronze", "Silver", "Gold", "Platinum"].map((tier, i) => ({
  id: `c4a05a00-0000-4000-8000-00000000000${i + 1}`, category: "Tactics",
  name: `Chaos Mastery: ${tier}`, tier, xpValue: 0
} as Badge));
describe("Chaos Mastery", () => {
  it("matches existing survival thresholds and coin bonuses", () => {
    expect(badges.map(getTacticalMilestone)).toEqual([
      { puzzles: 10, coins: 20, rank: 1 }, { puzzles: 20, coins: 40, rank: 2 },
      { puzzles: 30, coins: 100, rank: 3 }, { puzzles: 40, coins: 200, rank: 4 }
    ]);
  });
  it("groups earned tiers highest first and deduplicates", () => {
    expect(groupEarnedBadges([badges[0], badges[3], badges[0]]))
      .toEqual([{ badge: badges[3], tiers: [badges[3], badges[0]] }]);
  });
  it("does not infer the series from an unrelated name", () => {
    expect(isChaosMastery({ ...badges[0], id: "other" })).toBe(false);
    expect(groupEarnedBadges([badges[0], { ...badges[0], id: "other" }])).toHaveLength(2);
  });
});
