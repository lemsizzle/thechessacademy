"use client";

import { displayedBadgeLabel } from "@/lib/badges/displayedBadge";
import { useDisplayedBadge } from "@/lib/badges/useDisplayedBadge";
import type { DisplayedBadge as DisplayedBadgeData } from "@/lib/types";

export function DisplayedBadge({ badge, studentId, size = "sm" }: { badge?: DisplayedBadgeData | null; studentId?: string; size?: "sm" | "lg" }) {
  const current = useDisplayedBadge(badge, studentId);
  if (!current) return null;
  const label = `Displayed badge: ${displayedBadgeLabel(current)}`;
  return <span data-displayed-badge={current.id} title={label} role="img" aria-label={label} className={`inline-flex shrink-0 items-center justify-center rounded-full border border-amber-200/35 bg-slate-950/60 ${size === "lg" ? "size-12" : "size-7"}`}>
    <img src={current.imageUrl} alt="" width={size === "lg" ? 48 : 28} height={size === "lg" ? 48 : 28} loading="lazy" decoding="async" className="h-full w-full rounded-full object-contain" />
  </span>;
}
