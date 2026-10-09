import { getBadgeArtUrl } from "./art";
import type { BadgeCategory, BadgeTier, DisplayedBadge } from "@/lib/types";

export const DISPLAYED_BADGE_CHANGED = "chess-quest-displayed-badge-changed";
export const DISPLAY_BADGE_COLUMNS = "id,name,category,tier,final_image_url,art_image_url";
export type DisplayBadgeRow = { id: string; name: string; category: string; tier: string | null; final_image_url: string | null; art_image_url: string | null };

export function toDisplayedBadge(row: DisplayBadgeRow): DisplayedBadge {
  const tiers: Record<string, BadgeTier> = { C: "Bronze", B: "Silver", A: "Gold", S: "Platinum", SS: "Adamantium" };
  const tier = row.category === "Concepts" || row.category === "Concept Badges" ? undefined : row.tier ? tiers[row.tier] ?? row.tier as BadgeTier : undefined;
  return { id: row.id, name: row.name, tier, imageUrl: getBadgeArtUrl({ id: row.id, name: row.name, category: row.category as BadgeCategory, tier, finalImageUrl: row.final_image_url, artImageUrl: row.art_image_url }) };
}

export function displayedBadgeLabel(badge: DisplayedBadge) {
  return badge.tier && !badge.name.toLowerCase().includes(badge.tier.toLowerCase()) ? `${badge.name} · ${badge.tier}` : badge.name;
}

export function parseDisplayedBadgeChoice(body: unknown): string | null {
  if (!body || typeof body !== "object" || Array.isArray(body) || !("badgeId" in body)) throw new Error("Choose a badge to display.");
  const id = (body as { badgeId: unknown }).badgeId;
  if (id === null) return null;
  if (typeof id !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) throw new Error("Invalid badge ID.");
  return id;
}

export function announceDisplayedBadge(studentId: string, badge: DisplayedBadge | null) {
  window.dispatchEvent(new CustomEvent(DISPLAYED_BADGE_CHANGED, { detail: { studentId, badge } }));
}
