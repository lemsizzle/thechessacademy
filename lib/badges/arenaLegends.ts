import type { Badge } from "@/lib/types";

export const arenaLegends = [
  { id: "a8e9a000-0000-4000-8000-000000000003", name: "Arena Legends: Bronze Contender", tier: "Bronze", rank: 1, requirement: "Finish 3rd in an in-app tournament." },
  { id: "a8e9a000-0000-4000-8000-000000000002", name: "Arena Legends: Silver Challenger", tier: "Silver", rank: 2, requirement: "Finish 2nd in an in-app tournament." },
  { id: "a8e9a000-0000-4000-8000-000000000001", name: "Arena Legends: Golden Champion", tier: "Gold", rank: 3, requirement: "Finish 1st in an in-app tournament." },
  { id: "a8e9a000-0000-4000-8000-000000000005", name: "Arena Legends: Platinum Dynasty", tier: "Platinum", rank: 4, requirement: "Win 5 distinct in-app tournaments." }
] as const;

export function getArenaLegend(badge: Pick<Badge, "id" | "category">) {
  return badge.category === "Tournament" ? arenaLegends.find((entry) => entry.id === badge.id) : undefined;
}
