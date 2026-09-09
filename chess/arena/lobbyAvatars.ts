import type { AvatarCategory, AvatarItem, StudentAvatarConfig } from "@/lib/types";

function hash(value: string) {
  let result = 2166136261;
  for (const character of value) result = Math.imul(result ^ character.charCodeAt(0), 16777619);
  return result >>> 0;
}

/** Seeded selection is identical for every viewer and survives lobby refreshes. */
export function arenaBotAvatar(arenaId: string, botId: string, items: AvatarItem[]): StudentAvatarConfig {
  const equippedItems: StudentAvatarConfig["equippedItems"] = {};
  const selected = new Map<AvatarCategory, { id: string; weight: number }>();
  for (const item of items) {
    if (!item.isActive || !item.assetUrl || item.category === "board_theme") continue;
    const weight = hash(`${arenaId}:${botId}:${item.category}:${item.id}`);
    const previous = selected.get(item.category);
    if (!previous || weight > previous.weight || (weight === previous.weight && item.id < previous.id)) {
      selected.set(item.category, { id: item.id, weight });
    }
  }
  for (const [category, item] of selected) equippedItems[category] = item.id;
  return { studentId: botId, equippedItems };
}
