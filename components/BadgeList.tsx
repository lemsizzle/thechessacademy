"use client";

import { useState } from "react";
import { BadgeDetails } from "@/components/BadgeCard";
import { getTacticalMilestone, tacticalTier } from "@/lib/badges/tacticalMilestones";
import { isChaosMastery } from "@/lib/badges/chaosMastery";
import { isSurvivalAdamantium } from "@/lib/badges/survivalAdamantium";
import { isGameAchievement } from "@/lib/badges/gameAchievements/catalog";
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
  const specialBadges = new Set(sorted.filter(badge => !isGameAchievement(badge) &&
    /\b(?:buy|purchase|purchases|purchasing|equip|unlock|own|collect)\b.*\b(?:avatar|store|item|outfit|shirt|crown|cosmetic)s?\b|\bavatar store\b/i.test(badge.unlockRequirement)
  ).map(badge => badge.id));
  const puzzleBadges = new Set(sorted.filter(badge => !specialBadges.has(badge.id) && !isGameAchievement(badge) && (
    getTacticalMilestone(badge) || /\bpuzzles?\b|\bsurvival\b/i.test(`${badge.name} ${badge.unlockRequirement}`)
  )).map(badge => badge.id));
  const sections = [
    { id: "puzzle-badges", title: "Puzzle badges", badges: sorted.filter(badge => puzzleBadges.has(badge.id)) },
    { id: "gameplay-badges", title: "Gameplay badges", badges: sorted.filter(badge => !puzzleBadges.has(badge.id) && !specialBadges.has(badge.id)) },
    { id: "special-condition-badges", title: "Special Conditions", badges: sorted.filter(badge => specialBadges.has(badge.id)) }
  ];
  return <>
    <nav aria-label="Badge sections" className="mb-6 flex flex-wrap gap-4 text-sm font-bold text-cyan-200">
      {sections.map(section => <a key={section.id} href={`#${section.id}`} className="min-h-11 content-center underline underline-offset-4">{section.title} ({section.badges.length})</a>)}
    </nav>
    {sections.map(section => <section key={section.id} id={section.id} aria-labelledby={`${section.id}-title`} className="mb-8 scroll-mt-24">
      <h2 id={`${section.id}-title`} className="mb-3 text-xl font-black text-white">{section.title} <span className="text-sm font-normal text-slate-400">({section.badges.length})</span></h2>
      <ol aria-label={`${section.title} and requirements`} className="list-decimal divide-y divide-white/10 rounded-xl border border-white/10 bg-slate-950/70 pl-12 marker:font-bold marker:tabular-nums marker:text-slate-400 sm:pl-14">
      {section.badges.map(badge => <li key={badge.id} className="py-4 pl-1 pr-4 sm:pr-6">
        <button type="button" aria-haspopup="dialog" onClick={() => setSelected(badge)} className="min-h-11 text-left font-bold text-cyan-200 underline decoration-cyan-200/40 underline-offset-4 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cyan-200">
          {badge.name}{badge.tier && !badge.name.toLowerCase().includes(tacticalTier(badge.tier)!.toLowerCase()) ? ` · ${tacticalTier(badge.tier)}` : ""}
        </button>
        <p className="mt-1 text-sm leading-6 text-slate-300">{requirement(badge)}</p>
      </li>)}
      </ol>
      {!section.badges.length && <p className="py-6 text-slate-300">No badges in this section yet.</p>}
    </section>)}
    {selected && <BadgeDetails badge={selected} earnedTiers={[selected]} statusText="Badge catalog" onClose={() => setSelected(null)} />}
  </>;
}
