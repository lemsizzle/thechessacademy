"use client";

import { useState } from "react";
import { BadgeDetails } from "@/components/BadgeCard";
import { getTacticalMilestone, tacticalTier } from "@/lib/badges/tacticalMilestones";
import { isChaosMastery } from "@/lib/badges/chaosMastery";
import { isSurvivalAdamantium } from "@/lib/badges/survivalAdamantium";
import type { Badge } from "@/lib/types";

function requirement(badge: Badge) {
  const milestone = getTacticalMilestone(badge);
  if (milestone && !isChaosMastery(badge) && !isSurvivalAdamantium(badge)) {
    return `Solve ${milestone.puzzles} different puzzles without hints in one Survival round for this tactic.`;
  }
  return badge.unlockRequirement || "Ask your teacher about this badge's requirements.";
}

export function BadgeList({ badges }: { badges: Badge[] }) {
  const [selected, setSelected] = useState<Badge | null>(null);
  const sorted = [...badges].sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));
  return <>
    <ul aria-label="All badges and requirements" className="divide-y divide-white/10 rounded-xl border border-white/10 bg-slate-950/70">
      {sorted.map(badge => <li key={badge.id} className="px-4 py-4 sm:px-6">
        <button type="button" aria-haspopup="dialog" onClick={() => setSelected(badge)} className="min-h-11 text-left font-bold text-cyan-200 underline decoration-cyan-200/40 underline-offset-4 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cyan-200">
          {badge.name}{badge.tier && !badge.name.toLowerCase().includes(tacticalTier(badge.tier)!.toLowerCase()) ? ` · ${tacticalTier(badge.tier)}` : ""}
        </button>
        <p className="mt-1 text-sm leading-6 text-slate-300">{requirement(badge)}</p>
      </li>)}
    </ul>
    {!sorted.length && <p className="py-6 text-slate-300">No badges are available yet.</p>}
    {selected && <BadgeDetails badge={selected} earnedTiers={[selected]} statusText="Badge catalog" onClose={() => setSelected(null)} />}
  </>;
}
