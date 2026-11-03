import type { AvatarItem } from "@/lib/types";

export const STORE_REWARD_PRICES = {
  mystery_box: 500,
  free_class: 5000,
} as const;
export type StoreRewardKind = keyof typeof STORE_REWARD_PRICES;
export type StoreRewardReceipt = {
  id: string;
  student_id: string;
  kind: StoreRewardKind;
  price_paid: number;
  item_id: string | null;
  item_snapshot: {
    id: string;
    name: string;
    price: number;
    rarity: string;
    thumbnail_url: string | null;
    asset_url: string | null;
  } | null;
  status: "awarded" | "pending" | "fulfilled" | "refunded";
  created_at: string;
  resolved_at: string | null;
};
export function mysteryBoxPool(
  items: AvatarItem[],
  ownedIds: readonly string[],
) {
  const owned = new Set(ownedIds);
  const eligible = items.filter(
    (item) =>
      item.isActive &&
      item.unlockType === "purchase" &&
      item.price > 0 &&
      item.category !== "board_theme" &&
      !owned.has(item.id),
  );
  const totalWeight = eligible.reduce((sum, item) => sum + 1 / item.price, 0);
  return eligible.map((item) => ({
    item,
    chance: 1 / item.price / totalWeight,
  }));
}
