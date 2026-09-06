import type { AvatarItem } from "@/lib/types";
import { PAPER_CHESS_SET_SLUG } from "@/chess/appearance/themes";

export const paperChessSet: AvatarItem = {
  id: "98be0000-0000-4000-8000-000000000001",
  slug: PAPER_CHESS_SET_SLUG,
  name: "Paper Chess Set",
  description: "A warm, textured paper board and a complete set of cream and charcoal paper-cut pieces. Unlock both, then mix and match using the gear beside your board.",
  category: "board_theme", rarity: "Rare", price: 800,
  assetUrl: "/chess/themes/paper-preview.svg", thumbnailUrl: "/chess/themes/paper-preview.svg",
  layerOrder: 0, unlockType: "purchase", unlockRequirement: null,
  isActive: true, isFeatured: true, createdAt: "2026-09-06T00:00:00Z"
};
