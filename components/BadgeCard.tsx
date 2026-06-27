import { getBadgeTierStyles, getTierAura } from "@/lib/badges";
import type { Badge } from "@/lib/types";

function getFallbackBadgeArtUrl(badge: Badge) {
  const variant = (badge.id.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0) % 3) + 1;
  const params = new URLSearchParams({ badge: badge.name, category: badge.category });
  return `/mock-badge-art/${badge.tier?.toLowerCase() ?? "concept"}-${variant}.svg?${params.toString()}`;
}

export function BadgeCard({ badge, earned = false, compact = false, statusText }: { badge: Badge; earned?: boolean; compact?: boolean; statusText?: string }) {
  const tierStyles = getBadgeTierStyles(badge.tier);
  const aura = getTierAura(badge.tier);
  const imageUrl = badge.finalImageUrl || badge.artImageUrl || getFallbackBadgeArtUrl(badge);
  return (
    <article className={`relative overflow-hidden rounded-lg border p-4 ${tierStyles} ${earned ? "" : "grayscale opacity-55"}`}>
      <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${aura}`} />
      <div className="flex items-start gap-4">
        <div className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-full border bg-gradient-to-br ${aura} p-1 shadow-glow`}>
          <img src={imageUrl} alt={`${badge.name} badge art`} className="h-full w-full rounded-full object-cover" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-sm font-black text-white">{badge.name}</h3>
            {badge.tier && <span className="rounded border border-white/15 bg-black/25 px-2 py-0.5 text-xs font-black">{badge.tier}</span>}
          </div>
          {!compact && <p className="mt-1 text-sm text-slate-300">{badge.description}</p>}
          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            <span className="rounded bg-white/10 px-2 py-1">{badge.category}</span>
            <span className="rounded bg-white/10 px-2 py-1">{badge.xpValue} XP</span>
            <span className="rounded bg-white/10 px-2 py-1">{statusText ?? (earned ? "Earned" : "Locked")}</span>
          </div>
          {!compact && <p className="mt-3 text-xs text-slate-400">Unlock: {badge.unlockRequirement}</p>}
        </div>
      </div>
    </article>
  );
}
