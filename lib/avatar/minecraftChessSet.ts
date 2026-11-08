import type { AvatarItem } from "@/lib/types";
import { MINECRAFT_CHESS_SET_SLUG } from "@/chess/appearance/themes";

export const minecraftChessSet: AvatarItem = {
  id: "98be0000-0000-4000-8000-000000000005",
  slug: MINECRAFT_CHESS_SET_SLUG, name: "Minecraft Chess Set",
  description: "Build your next victory. Minecraft-inspired quartz and deepslate pieces with diamond and amethyst accents, blocky horse knights, creeper-carved towers and distinct royal crowns. Includes a grass-and-stone board and all matching pieces.",
  category: "board_theme", rarity: "Mythic", price: 1000,
  assetUrl: "/chess/themes/minecraft-preview.svg", thumbnailUrl: "/chess/themes/minecraft-preview.svg",
  layerOrder: 0, unlockType: "purchase", unlockRequirement: null,
  isActive: true, isFeatured: true, createdAt: "2026-11-09T00:00:00+07:00"
};
