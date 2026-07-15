import type { AvatarItem, StudentWallet } from "@/lib/types";

export function canPurchaseAvatarItem(wallet: StudentWallet, item: AvatarItem, ownedItemIds: Set<string>) {
  if (!item.isActive) return { ok: false, reason: "This item is not available right now." };
  if (ownedItemIds.has(item.id)) return { ok: false, reason: "Item already owned." };
  if (item.unlockType !== "purchase") return { ok: false, reason: "This item is unlocked through achievements or by your teacher." };
  if (wallet.academyCoins < item.price) return { ok: false, reason: "Not enough Academy Coins." };
  return { ok: true, reason: "Ready to purchase." };
}

export function canEquipAvatarItem(itemId: string | null, ownedItemIds: Set<string>) {
  if (!itemId) return { ok: true, reason: "Slot can be cleared." };
  if (!ownedItemIds.has(itemId)) return { ok: false, reason: "You must own this item before equipping it." };
  return { ok: true, reason: "Ready to equip." };
}

export function applyCoinDelta(wallet: StudentWallet, amount: number): StudentWallet {
  const nextBalance = Math.max(0, wallet.academyCoins + amount);
  return {
    ...wallet,
    academyCoins: nextBalance,
    totalCoinsEarned: amount > 0 ? wallet.totalCoinsEarned + amount : wallet.totalCoinsEarned,
    totalCoinsSpent: amount < 0 ? wallet.totalCoinsSpent + Math.abs(amount) : wallet.totalCoinsSpent
  };
}
