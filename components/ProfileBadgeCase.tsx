import { BadgeCard } from "@/components/BadgeCard";
import { groupEarnedBadges } from "@/lib/badges/tacticalMilestones";
import type { Badge } from "@/lib/types";

export function ProfileBadgeCase({ badges, badgeIds }: { badges: Badge[]; badgeIds: string[] }) {
  const earnedIds = new Set(badgeIds);
  const groups = groupEarnedBadges(badges.filter((badge) => earnedIds.has(badge.id)));

  return (
    <section aria-label="Earned badges" className="rounded-xl border border-amber-200/20 bg-slate-950 p-4 sm:p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-xl font-black text-white">Trophy Case</h2>
        <span className="text-sm font-bold text-amber-100">{groups.length} {groups.length === 1 ? "badge" : "badges"}</span>
      </div>
      {groups.length ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
          {groups.map(({ badge, tiers }) => (
            <BadgeCard key={badge.id} badge={badge} earnedTiers={tiers} earned statusText={badge.isLegacy ? "Legacy earned" : "Earned"} />
          ))}
        </div>
      ) : <p className="text-sm text-slate-400">No badges earned yet.</p>}
    </section>
  );
}
