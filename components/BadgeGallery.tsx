"use client";

import { Card } from "@/components/Card";
import { conceptThemes, tacticDescriptions, tacticThemes } from "@/data/badges";
import { getBadgeTierStyles, getTierAura } from "@/lib/badges";
import type { Badge, BadgeCategory, BadgeTier, ConceptTheme, TacticTheme } from "@/lib/types";
import { useMemo, useState } from "react";

const tiers: Array<Extract<BadgeTier, "Bronze" | "Silver" | "Gold" | "Platinum">> = ["Bronze", "Silver", "Gold", "Platinum"];

function getFallbackBadgeArtUrl(badge: Badge) {
  const params = new URLSearchParams({ badge: badge.name, category: badge.category });
  return `/mock-badge-art/${badge.tier?.toLowerCase() ?? "concept"}-1.svg?${params.toString()}`;
}

export function BadgeGallery({ badges }: { badges: Badge[] }) {
  const [category, setCategory] = useState<Extract<BadgeCategory, "Tactics" | "Concepts">>("Tactics");
  const [tacticTheme, setTacticTheme] = useState<"All" | TacticTheme>("All");
  const [conceptTheme, setConceptTheme] = useState<"All" | ConceptTheme>("All");

  const filtered = useMemo(() => badges.filter((badge) => (
    badge.isActive !== false &&
    badge.isLegacy !== true &&
    badge.category === category &&
    (category !== "Tactics" || tacticTheme === "All" || badge.tacticTheme === tacticTheme) &&
    (category !== "Concepts" || conceptTheme === "All" || badge.conceptTheme === conceptTheme)
  )), [badges, category, conceptTheme, tacticTheme]);

  const tacticGroups = tacticThemes
    .map((theme) => ({ theme, badges: filtered.filter((badge) => badge.tacticTheme === theme) }))
    .filter((group) => group.badges.length > 0);
  const conceptBadges = conceptThemes
    .map((theme) => filtered.find((badge) => badge.conceptTheme === theme))
    .filter((badge): badge is Badge => Boolean(badge));

  return (
    <div className="space-y-5">
      <Card className="p-4">
        <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto] md:items-end">
          <label className="grid gap-1 text-xs font-bold text-slate-300">Category
            <select className="rounded-md border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white" value={category} onChange={(event) => setCategory(event.target.value as Extract<BadgeCategory, "Tactics" | "Concepts">)}>
              <option>Tactics</option>
              <option>Concepts</option>
            </select>
          </label>
          {category === "Tactics" ? (
            <label className="grid gap-1 text-xs font-bold text-slate-300">Tactic Theme
              <select className="rounded-md border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white" value={tacticTheme} onChange={(event) => setTacticTheme(event.target.value as "All" | TacticTheme)}>
                <option>All</option>
                {tacticThemes.map((theme) => <option key={theme}>{theme}</option>)}
              </select>
            </label>
          ) : (
            <label className="grid gap-1 text-xs font-bold text-slate-300">Concept Theme
              <select className="rounded-md border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white" value={conceptTheme} onChange={(event) => setConceptTheme(event.target.value as "All" | ConceptTheme)}>
                <option>All</option>
                {conceptThemes.map((theme) => <option key={theme}>{theme}</option>)}
              </select>
            </label>
          )}
          <p className="rounded-md border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold text-slate-300">
            {category === "Tactics" ? `${tacticGroups.length} tactic sets` : `${conceptBadges.length} concept badges`}
          </p>
        </div>
        <p className="mt-3 text-xs text-slate-400">
          {category === "Tactics" ? "Each tactic card contains Bronze, Silver, Gold, and Platinum requirements." : "Concept badges are one-time mastery achievements with no tiers."}
        </p>
      </Card>

      {category === "Tactics" ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {tacticGroups.map((group) => {
          const showcase = group.badges.find((badge) => badge.tier === "Platinum") ?? group.badges[0];
          const imageUrl = showcase.finalImageUrl || showcase.artImageUrl || getFallbackBadgeArtUrl(showcase);

          return (
            <Card key={group.theme} className="overflow-hidden p-0">
              <div className={`h-1 bg-gradient-to-r ${getTierAura("Platinum")}`} />
              <div className="p-4">
                <div className="flex items-start gap-4">
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full border border-cyan-100/50 bg-gradient-to-br from-white via-cyan-100 to-fuchsia-200 p-1 shadow-glow">
                    <img src={imageUrl} alt={`${group.theme} badge art`} className="h-full w-full rounded-full object-cover" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h2 className="font-black text-white">{group.theme}</h2>
                    <p className="mt-1 text-sm text-slate-300">{tacticDescriptions[group.theme]}</p>
                  </div>
                </div>

                <div className="mt-4 grid gap-2">
                  {tiers.map((tierName) => {
                    const badge = group.badges.find((item) => item.tier === tierName);
                    if (!badge) return null;
                    return (
                      <div key={badge.id} className={`grid grid-cols-[88px_1fr_auto] items-center gap-2 rounded-md border px-3 py-2 text-xs ${getBadgeTierStyles(badge.tier)}`}>
                        <span className="font-black">{badge.tier}</span>
                        <span className="text-slate-200">{badge.requiredPuzzleCount} puzzles</span>
                        <span className="font-black">{badge.xpValue} XP</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </Card>
          );
        })}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {conceptBadges.map((badge) => {
            const imageUrl = badge.finalImageUrl || badge.artImageUrl || getFallbackBadgeArtUrl(badge);
            return (
              <Card key={badge.id} className="overflow-hidden p-0">
                <div className={`h-1 bg-gradient-to-r ${getTierAura()}`} />
                <div className="p-4">
                  <div className="flex items-start gap-4">
                    <div className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-full border bg-gradient-to-br ${getTierAura()} p-1 shadow-glow`}>
                      <img src={imageUrl} alt={`${badge.name} badge art`} className="h-full w-full rounded-full object-cover" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h2 className="font-black text-white">{badge.name}</h2>
                      <p className="mt-1 text-sm text-slate-300">{badge.description}</p>
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2 text-xs">
                    <span className="rounded bg-white/10 px-2 py-1">Concept</span>
                    <span className="rounded bg-white/10 px-2 py-1">{badge.xpValue} XP</span>
                  </div>
                  <p className="mt-3 text-xs text-slate-400">Unlock: {badge.unlockRequirement}</p>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
