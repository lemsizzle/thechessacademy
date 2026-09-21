import type { Badge } from "@/lib/types";

export const SURVIVAL_ADAMANTIUM_ID = "ada00000-0000-4000-8000-000000000050";
export const survivalAdamantiumBadge: Badge = {
  id: SURVIVAL_ADAMANTIUM_ID, name: "Survival: Adamantium", category: "Boss Achievements",
  tier: "Adamantium", xpValue: 1000, isActive: true, generationStatus: "selected",
  description: "A score of fifty. An achievement of extraordinary endurance.",
  unlockRequirement: "Solve 50 different puzzles without hints in one Survival round, in any theme or variant. Earn 1,000 XP and 1,000 Academy Coins once.",
  visualTheme: "Adamantium Survival medal (placeholder artwork)",
  artImageUrl: "/badges/survival-adamantium-placeholder.svg", finalImageUrl: null
};
export function isSurvivalAdamantium(badge: Pick<Badge, "id">) { return badge.id === SURVIVAL_ADAMANTIUM_ID; }
