import type { AvatarRarity, AvatarUnlockType } from "@/lib/types";

export const academyCoinEconomy = {
  xpToCoinRate: 1,
  rarityPriceRanges: {
    Common: { min: 5, max: 15 },
    Uncommon: { min: 20, max: 35 },
    Rare: { min: 40, max: 65 },
    Epic: { min: 75, max: 110 },
    Legendary: { min: 125, max: 175 }
  } satisfies Record<AvatarRarity, { min: number; max: number }>,
  itemPrices: {
    "pawn-cap": 5,
    "chessboard-t-shirt": 10,
    "bishop-glasses": 12,
    "knight-headphones": 20,
    "rook-backpack": 25,
    "rapid-racer-goggles": 35,
    "puzzle-wizard-hat": 40,
    "knight-helmet": 50,
    "queens-cape": 65,
    "mini-rook-companion": 70,
    "checkmate-crown": 90,
    "grandmaster-suit": 100,
    "glowing-chess-eyes": 110,
    "dark-king-armor": 135,
    "golden-grandmaster-aura": 150
  } as Record<string, number>
};

export function getConfiguredAvatarPrice(slug: string, fallbackPrice: number, unlockType: AvatarUnlockType) {
  if (unlockType !== "purchase") return 0;
  return academyCoinEconomy.itemPrices[slug] ?? fallbackPrice;
}

export function normalizeAvatarPrice(input: { slug: string; price: number; unlockType: AvatarUnlockType }) {
  if (input.unlockType !== "purchase") return 0;
  return Math.max(0, Math.floor(Number(input.price) || academyCoinEconomy.itemPrices[input.slug] || 0));
}

export function coinsFromXp(xp: number) {
  return Math.max(0, Math.floor(Number(xp) || 0) * academyCoinEconomy.xpToCoinRate);
}
