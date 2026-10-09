import type { Badge } from "@/lib/types";

export function getBadgeArtUrl(badge: Pick<Badge, "id" | "name" | "category" | "tier" | "finalImageUrl" | "artImageUrl">) {
  if (badge.finalImageUrl || badge.artImageUrl) return badge.finalImageUrl || badge.artImageUrl!;
  const variant = (badge.id.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0) % 3) + 1;
  const params = new URLSearchParams({ badge: badge.name, category: badge.category });
  return `/mock-badge-art/${badge.tier?.toLowerCase() ?? "concept"}-${variant}.svg?${params.toString()}`;
}
