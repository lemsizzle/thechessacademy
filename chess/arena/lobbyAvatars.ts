import type { AvatarCategory, AvatarItem, StudentAvatarConfig } from "@/lib/types";
import { seedAvatarItems } from "@/lib/avatar/catalog";

// A plain face is the foundation, not part of the randomized outfit.
const defaultFace = seedAvatarItems.filter((item) => item.slug === "bright-quest-eyes" || item.slug === "brave-smile");

function hash(value: string) {
  let result = 2166136261;
  for (const character of value) result = Math.imul(result ^ character.charCodeAt(0), 16777619);
  return result >>> 0;
}

/** Seeded selection is identical for every viewer and survives lobby refreshes. */
export function arenaBotAvatar(arenaId: string, botId: string, items: AvatarItem[]): StudentAvatarConfig {
  const equippedItems: StudentAvatarConfig["equippedItems"] = {};
  for (const fallback of defaultFace) {
    const item = items
      .filter((item) => item.slug === fallback.slug && item.isActive && item.assetUrl)
      .sort((left, right) => left.id < right.id ? -1 : left.id > right.id ? 1 : 0)[0] ?? fallback;
    equippedItems[item.category] = item.id;
  }
  const selected = new Map<AvatarCategory, { id: string; weight: number }>();
  for (const item of items) {
    if (!item.isActive || !item.assetUrl || item.category === "board_theme" || item.unlockType === "default" || defaultFace.some((fallback) => item.slug === fallback.slug)) continue;
    const weight = hash(`${arenaId}:${botId}:${item.category}:${item.id}`);
    const previous = selected.get(item.category);
    if (!previous || weight > previous.weight || (weight === previous.weight && item.id < previous.id)) {
      selected.set(item.category, { id: item.id, weight });
    }
  }
  const count = 2 + hash(`${arenaId}:${botId}:outfit-size`) % 2;
  // Rank slots independently of the item catalog so reduced lobby/game payloads
  // reconstruct the same outfit without adding new items or reshuffling it.
  const slots = [...selected].sort(([left], [right]) => {
    const difference = hash(`${arenaId}:${botId}:slot:${right}`) - hash(`${arenaId}:${botId}:slot:${left}`);
    return difference || (left < right ? -1 : left > right ? 1 : 0);
  });
  for (const [category, item] of slots.slice(0, count)) equippedItems[category] = item.id;
  return { studentId: botId, equippedItems };
}
