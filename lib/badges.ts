import type { Badge, BadgeTier } from "@/lib/types";

export function getBadgeTierStyles(tier?: BadgeTier) {
  const styles = {
    Concept: "border-violet-300/50 bg-violet-400/10 text-violet-100 shadow-[0_0_28px_rgba(167,139,250,0.22)]",
    Bronze: "border-orange-400/45 bg-orange-500/10 text-orange-100 shadow-[0_0_24px_rgba(251,146,60,0.18)]",
    Silver: "border-slate-200/55 bg-slate-200/10 text-slate-100 shadow-[0_0_24px_rgba(226,232,240,0.2)]",
    Gold: "border-amber-300/60 bg-amber-400/10 text-amber-100 shadow-[0_0_28px_rgba(245,158,11,0.28)]",
    Platinum: "border-cyan-100/70 bg-cyan-200/10 text-cyan-50 shadow-[0_0_36px_rgba(125,211,252,0.34)]",
    C: "border-emerald-400/40 bg-emerald-400/10 text-emerald-100 shadow-[0_0_24px_rgba(52,211,153,0.18)]",
    B: "border-sky-300/50 bg-sky-400/10 text-sky-100 shadow-[0_0_24px_rgba(56,189,248,0.2)]",
    A: "border-amber-300/60 bg-amber-400/10 text-amber-100 shadow-[0_0_26px_rgba(245,158,11,0.24)]",
    S: "border-fuchsia-200/70 bg-fuchsia-400/10 text-fuchsia-50 shadow-[0_0_34px_rgba(217,70,239,0.32)]"
  };

  return tier ? styles[tier] : styles.Concept;
}

export function getTierAura(tier?: BadgeTier) {
  return {
    Concept: "from-violet-200 via-cyan-200 to-amber-200",
    Bronze: "from-orange-300 via-amber-600 to-stone-800",
    Silver: "from-white via-slate-300 to-sky-300",
    Gold: "from-yellow-200 via-amber-300 to-yellow-600",
    Platinum: "from-white via-cyan-100 to-fuchsia-200",
    C: "from-emerald-300 via-lime-200 to-amber-600",
    B: "from-sky-200 via-blue-300 to-slate-100",
    A: "from-amber-200 via-violet-300 to-yellow-500",
    S: "from-white via-fuchsia-200 to-cyan-200"
  }[tier ?? "Concept"];
}

function getTierPromptStyle(tier: BadgeTier) {
  return {
    Bronze: "bronze glow, beginner magical emblem",
    Silver: "silver glow, polished magical emblem",
    Gold: "gold glow, heroic magical emblem",
    Platinum: "platinum radiant glow, legendary boss-level emblem",
    C: "novice green and bronze glow, simple magic",
    B: "silver and blue glow, stronger magic",
    A: "gold and purple glow, elite magic",
    S: "legendary radiant aura, divine boss-level energy"
  }[tier];
}

export function buildDefaultBadgeImagePrompt(badge: Badge) {
  if (badge.tacticTheme) {
    return [
      `Create a collectible circular chess achievement badge icon for the tactic ${badge.tacticTheme}, ${badge.tier} tier.`,
      `Use ${getTierPromptStyle(badge.tier ?? "Bronze")}.`,
      `Unlock requirement: ${badge.unlockRequirement}.`,
      `Chess tactic symbolism: ${badge.visualTheme}.`,
      "Magical chess academy theme, glowing border, clean centered emblem/icon composition, fantasy anime-inspired, suitable for a web app UI, no text."
    ].join(" ");
  }

  if (badge.conceptTheme) {
    return [
      `Create a collectible circular chess achievement badge icon for the chess concept ${badge.conceptTheme}.`,
      `Unlock requirement: ${badge.unlockRequirement}.`,
      `Chess concept symbolism: ${badge.visualTheme}.`,
      "Magical chess academy style, glowing strategic aura, clean centered emblem/icon composition, fantasy anime-inspired, suitable for a web app UI, no text."
    ].join(" ");
  }

  return [
    "Circular collectible achievement badge art for a dark magical chess academy web app.",
    `Badge name: ${badge.name}.`,
    `Meaning: ${badge.description}.`,
    `Category: ${badge.category}. ${badge.tier ? `Tier: ${badge.tier}. ` : ""}XP value: ${badge.xpValue}.`,
    `Unlock requirement: ${badge.unlockRequirement}.`,
    `Visual theme: ${badge.visualTheme}.`,
    "Create an emblem-like icon with a glowing border, clean centered chess/fantasy symbol, fantasy anime shonen energy, polished game UI rendering.",
    "Do not include readable text, letters, numbers, captions, UI labels, watermarks, or messy background clutter inside the image."
  ].join(" ");
}

export function buildBadgeImagePrompt(badge: Badge) {
  return badge.imagePrompt?.trim() || buildDefaultBadgeImagePrompt(badge);
}

export function getMockBadgeArtOptions(badge: Badge) {
  const encodedName = encodeURIComponent(badge.name);
  const encodedCategory = encodeURIComponent(badge.category);
  const encodedPrompt = encodeURIComponent(buildBadgeImagePrompt(badge));
  const tier = badge.tier?.toLowerCase() ?? "concept";
  return [1, 2, 3].map((variant) => `/mock-badge-art/${tier}-${variant}.svg?badge=${encodedName}&category=${encodedCategory}&prompt=${encodedPrompt}`);
}

export function getConceptBadges(badges: Badge[]) {
  return badges.filter((badge) => badge.category === "Concepts" || Boolean(badge.conceptTheme));
}

export function getActiveConceptBadges(badges: Badge[]) {
  return getConceptBadges(badges).filter((badge) => badge.isActive !== false && badge.isLegacy !== true);
}

export function getEarnedConceptBadges(badges: Badge[], badgeIds: string[]) {
  return getActiveConceptBadges(badges).filter((badge) => badgeIds.includes(badge.id));
}

export function awardConceptBadge(badgeIds: string[], badgeId: string) {
  return badgeIds.includes(badgeId) ? badgeIds : [...badgeIds, badgeId];
}
