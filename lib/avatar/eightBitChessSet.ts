import type { AvatarItem } from "@/lib/types";
import { EIGHT_BIT_CHESS_SET_SLUG } from "@/chess/appearance/themes";

export const eightBitChessSet: AvatarItem = {
  id: "98be0000-0000-4000-8000-000000000003",
  slug: EIGHT_BIT_CHESS_SET_SLUG,
  name: "8-Bit Chess Set",
  description: "Level up your next move! A retro mint-and-indigo pixel board with golden-cream and violet 8-bit pieces. Unlock the board and every matching piece, then mix and match using the gear beside your board.",
  category: "board_theme", rarity: "Epic", price: 800,
  assetUrl: "/chess/themes/eight-bit-preview.svg", thumbnailUrl: "/chess/themes/eight-bit-preview.svg",
  layerOrder: 0, unlockType: "purchase", unlockRequirement: null,
  isActive: true, isFeatured: true, createdAt: "2026-09-07T00:00:00+07:00"
};
