import type { AvatarItem } from "@/lib/types";
import { NARUTO_CHESS_SET_SLUG } from "@/chess/appearance/themes";

export const narutoChessSet: AvatarItem = {
  id: "98be0000-0000-4000-8000-000000000004",
  slug: NARUTO_CHESS_SET_SLUG, name: "Naruto Chess Set",
  description: "A Mythic shinobi showdown: Hidden Leaf ivory and gold against Akatsuki obsidian and crimson. Fox knights, kunai bishops and Hokage kings command a gold-sealed chakra board. Includes the board and all matching pieces.",
  category: "board_theme", rarity: "Mythic", price: 1000,
  assetUrl: "/chess/themes/naruto-preview.svg", thumbnailUrl: "/chess/themes/naruto-preview.svg",
  layerOrder: 0, unlockType: "purchase", unlockRequirement: null,
  isActive: true, isFeatured: true, createdAt: "2026-09-12T00:00:00+07:00"
};
