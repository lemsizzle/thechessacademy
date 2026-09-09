import type { Badge } from "@/lib/types";

const chaosMasteryIds = new Set(["c4a05a00-0000-4000-8000-000000000001","c4a05a00-0000-4000-8000-000000000002","c4a05a00-0000-4000-8000-000000000003","c4a05a00-0000-4000-8000-000000000004"]);

export function isChaosMastery(badge: Pick<Badge, "id" | "category">) {
  return badge.category === "Tactics" && chaosMasteryIds.has(badge.id);
}
