import type { AvatarItem } from "@/lib/types";
import { BLOSSOM_CHESS_SET_SLUG } from "@/chess/appearance/themes";

export const blossomChessSet: AvatarItem = {
  id: "98be0000-0000-4000-8000-000000000002",
  slug: BLOSSOM_CHESS_SET_SLUG,
  name: "Blossom Chess Set",
  description: "Make your next move bloom! A rose-and-lilac board with pearl and plum pieces, sweet bows, and sparkling crown jewels. Unlock the board and every matching piece, then mix and match using the gear beside your board.",
  category: "board_theme", rarity: "Rare", price: 400,
  assetUrl: "/chess/themes/blossom-preview.svg", thumbnailUrl: "/chess/themes/blossom-preview.svg",
  layerOrder: 0, unlockType: "purchase", unlockRequirement: null,
  isActive: true, isFeatured: true, createdAt: "2026-09-06T14:00:00Z"
};
