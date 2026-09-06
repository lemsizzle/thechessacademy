import { describe, expect, it } from "vitest";
import { groupEarnedBadges, getTacticalMilestone, inferBadgeTactic } from "@/lib/badges/tacticalMilestones";
import type { Badge } from "@/lib/types";

function badge(id: string, name: string, tier: Badge["tier"], category: Badge["category"] = "Tactics"): Badge {
  return { id, name, tier, category, description: "", unlockRequirement: "", xpValue: 10, visualTheme: "", artImageUrl: null, finalImageUrl: null, generationStatus: "idle" };
}

describe("tactical badge milestones and trophy case", () => {
  it.each([["C", 10, 20], ["Silver", 20, 40], ["A", 30, 100], ["Platinum", 40, 200]] as const)("maps %s to the correct threshold and coins", (tier, puzzles, coins) => {
    expect(getTacticalMilestone(badge("pin", "Pin Apprentice", tier))).toMatchObject({ puzzles, coins });
  });

  it("shows the highest tier per tactic while retaining all earned artwork and dates", () => {
    const bronze = { ...badge("pin-b", "Pin Apprentice", "C"), createdAt: "2026-08-01", finalImageUrl: "/bronze.png" };
    const gold = { ...badge("pin-g", "Pin Master", "Gold"), createdAt: "2026-09-01" };
    const fork = badge("fork", "Fork Master", "A");
    const input = [bronze, fork, gold];
    const groups = groupEarnedBadges(input);
    expect(groups).toEqual([{ badge: gold, tiers: [gold, bronze] }, { badge: fork, tiers: [fork] }]);
    expect(input).toEqual([bronze, fork, gold]);
  });

  it("keeps non-tactical achievements separate, even when their name contains a tactic", () => {
    const tournament = badge("event", "Fork tournament winner", "A", "Tournament");
    const streak = badge("streak", "Puzzle Streak", "A");
    expect(groupEarnedBadges([tournament, streak])).toHaveLength(2);
    expect(getTacticalMilestone(tournament)).toBeUndefined();
    expect(getTacticalMilestone(streak)).toBeUndefined();
    expect(inferBadgeTactic("Trapping Expert", "Tactics")).toBeUndefined();
    expect(inferBadgeTactic("Mate in Two", "Checkmates")).toBeUndefined();
  });

  it("deduplicates repeated awards and does not invent lower earned tiers", () => {
    const platinum = badge("p", "Pin Grandmaster", "S");
    expect(groupEarnedBadges([platinum, platinum])).toEqual([{ badge: platinum, tiers: [platinum] }]);
    expect(groupEarnedBadges([])).toEqual([]);
  });
});
