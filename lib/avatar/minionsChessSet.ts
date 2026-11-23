import type { AvatarItem } from "@/lib/types";
import { MINIONS_CHESS_SET_SLUG } from "@/chess/appearance/themes";

export const minionsChessSet: AvatarItem = {
  id: "98be0000-0000-4000-8000-000000000006",
  slug: MINIONS_CHESS_SET_SLUG, name: "Minions Chess Set",
  description: "Banana-powered checkmates! Yellow Minions face purple rivals in silver goggles and overalls. Round pawns, horse knights, split-mitre bishops, castle rooks and distinct royal crowns keep every role clear. Includes all matching pieces and a banana-yellow and navy board.",
  category: "board_theme", rarity: "Mythic", price: 1000,
  assetUrl: "/chess/themes/minions-preview.svg", thumbnailUrl: "/chess/themes/minions-preview.svg",
  layerOrder: 0, unlockType: "purchase", unlockRequirement: null,
  isActive: true, isFeatured: true, createdAt: "2026-11-23T00:00:00+07:00"
};
