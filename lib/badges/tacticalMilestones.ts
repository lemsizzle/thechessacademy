import type { Badge, BadgeTier, TacticTheme } from "@/lib/types";
import { getArenaLegend } from "./arenaLegends";

export const tacticalMilestones = {
  Bronze: { puzzles: 10, coins: 20, rank: 1 },
  Silver: { puzzles: 20, coins: 40, rank: 2 },
  Gold: { puzzles: 30, coins: 100, rank: 3 },
  Platinum: { puzzles: 40, coins: 200, rank: 4 }
} as const;

export function tacticalTier(tier?: BadgeTier) {
  if (tier === "C") return "Bronze";
  if (tier === "B") return "Silver";
  if (tier === "A") return "Gold";
  if (tier === "S") return "Platinum";
  return tier;
}

export function inferBadgeTactic(name: string, category: string): TacticTheme | undefined {
  if (category !== "Tactics" && category !== "Checkmates") return undefined;
  // Match tactic words, not arbitrary fragments (e.g. "Trapping" is not "Pin").
  const names: Array<[RegExp, TacticTheme]> = [
    [/\bfork\b/i, "Fork"], [/\bpin\b/i, "Pin"], [/\bskewer\b/i, "Skewer"],
    [/\bdiscovered attack\b/i, "Discovered Attack"], [/\bdouble attack\b/i, "Double Attack"],
    [/\bdeflection\b/i, "Deflection"], [/\bdecoy\b/i, "Decoy"],
    [/\bremoving the defender\b/i, "Removing the Defender"],
    [/\bback[ -]rank mate\b/i, "Back Rank Mate"], [/\bmate in (one|1)\b/i, "Mate in One"]
  ];
  return names.find(([pattern]) => pattern.test(name))?.[1];
}

export function getBadgeTactic(badge: Badge) {
  return badge.tacticTheme ?? inferBadgeTactic(badge.name, badge.category);
}

export function getTacticalMilestone(badge: Badge) {
  const tier = tacticalTier(badge.tier);
  return getBadgeTactic(badge) && tier ? tacticalMilestones[tier] : undefined;
}

export type EarnedBadgeGroup = { badge: Badge; tiers: Badge[] };

export function groupEarnedBadges(badges: Badge[]): EarnedBadgeGroup[] {
  const groups = new Map<string, EarnedBadgeGroup>();
  for (const badge of badges) {
    const tactic = getBadgeTactic(badge);
    const key = getArenaLegend(badge) ? "series:arena-legends" : tactic && getTacticalMilestone(badge) ? `tactic:${tactic}` : `badge:${badge.id}`;
    const group = groups.get(key);
    if (!group) groups.set(key, { badge, tiers: [badge] });
    else if (!group.tiers.some((item) => item.id === badge.id)) group.tiers.push(badge);
  }
  for (const group of groups.values()) {
    group.tiers.sort((a, b) => (getArenaLegend(b)?.rank ?? getTacticalMilestone(b)?.rank ?? 0) - (getArenaLegend(a)?.rank ?? getTacticalMilestone(a)?.rank ?? 0));
    group.badge = group.tiers[0];
  }
  return [...groups.values()];
}

export type TacticalBadgeAward = { badgeId: string; name: string; tier: string; coins: number };
