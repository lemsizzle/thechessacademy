import { describe, expect, it } from "vitest";
import { arenaLegends, getArenaLegend } from "@/lib/badges/arenaLegends";
import { groupEarnedBadges } from "@/lib/badges/tacticalMilestones";
import type { Badge } from "@/lib/types";
const badges: Badge[] = arenaLegends.map((b) => ({ ...b, category: "Tournament", description: b.requirement, unlockRequirement: b.requirement, xpValue: 0, visualTheme: "", artImageUrl: null, finalImageUrl: null, generationStatus: "pending" }));
describe("Arena Legends", () => {
  it("maps third, second, first and five wins to the requested tiers", () => {
    expect(arenaLegends.map(b=>b.tier)).toEqual(["Bronze","Silver","Gold","Platinum"]);
    expect(arenaLegends.map(b=>b.requirement)).toEqual(["Finish 3rd in an in-app tournament.","Finish 2nd in an in-app tournament.","Finish 1st in an in-app tournament.","Win 5 distinct in-app tournaments."]);
  });
  it("groups the series highest first without inventing unearned tiers", () => {
    expect(groupEarnedBadges([badges[0],badges[3],badges[0]])).toEqual([{badge:badges[3],tiers:[badges[3],badges[0]]}]);
    expect(groupEarnedBadges([badges[2]])[0].tiers).toEqual([badges[2]]);
  });
  it("does not group unrelated tournament badges by name alone", () => {
    expect(getArenaLegend({...badges[0],id:"other"})).toBeUndefined();
    expect(groupEarnedBadges([badges[0],{...badges[0],id:"other"}])).toHaveLength(2);
  });
});
