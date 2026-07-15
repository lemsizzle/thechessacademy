import { getConfiguredAvatarPrice } from "@/lib/avatar/economy";
import type { AvatarCategory, AvatarItem, AvatarRarity, AvatarUnlockType } from "@/lib/types";

export const avatarCategories: Array<{ id: AvatarCategory; label: string; layerOrder: number }> = [
  { id: "background", label: "Background", layerOrder: 0 },
  { id: "aura_effect", label: "Aura or Effect", layerOrder: 5 },
  { id: "base_face", label: "Base Face", layerOrder: 10 },
  { id: "skin_tone", label: "Skin Tone", layerOrder: 12 },
  { id: "eyes", label: "Eyes", layerOrder: 20 },
  { id: "eyebrows", label: "Eyebrows", layerOrder: 22 },
  { id: "mouth", label: "Mouth", layerOrder: 24 },
  { id: "hair", label: "Hair", layerOrder: 30 },
  { id: "facial_hair", label: "Facial Hair", layerOrder: 32 },
  { id: "clothing", label: "Clothing", layerOrder: 40 },
  { id: "headwear", label: "Headwear", layerOrder: 50 },
  { id: "glasses", label: "Glasses", layerOrder: 55 },
  { id: "chess_accessory", label: "Chess Accessory", layerOrder: 60 }
];

export const avatarRarities: AvatarRarity[] = ["Common", "Uncommon", "Rare", "Epic", "Legendary"];
export const avatarUnlockTypes: AvatarUnlockType[] = ["purchase", "achievement", "admin_grant", "default"];

export const avatarCategoryLabels = Object.fromEntries(avatarCategories.map((item) => [item.id, item.label])) as Record<AvatarCategory, string>;

export const avatarRarityStyles: Record<AvatarRarity, string> = {
  Common: "border-slate-300/30 bg-slate-300/10 text-slate-100",
  Uncommon: "border-emerald-300/40 bg-emerald-300/10 text-emerald-100",
  Rare: "border-sky-300/50 bg-sky-300/10 text-sky-100",
  Epic: "border-fuchsia-300/50 bg-fuchsia-300/10 text-fuchsia-100",
  Legendary: "border-amber-200/70 bg-amber-300/15 text-amber-100 shadow-gold"
};

const layerShapes: Record<AvatarCategory, string> = {
  background: "<rect width='160' height='160' rx='32' fill='%23fed7aa'/><path d='M0 118h160v42H0z' fill='%230f172a' opacity='.24'/>",
  aura_effect: "<circle cx='80' cy='78' r='58' fill='none' stroke='%23fde68a' stroke-width='9' opacity='.65'/><circle cx='80' cy='78' r='68' fill='none' stroke='%2367e8f9' stroke-width='4' opacity='.35'/>",
  base_face: "<circle cx='80' cy='72' r='42' fill='%23f8c9a8'/><path d='M48 113c10-18 54-18 64 0v28H48z' fill='%23334155'/>",
  skin_tone: "<circle cx='80' cy='72' r='39' fill='%23f2b892' opacity='.82'/>",
  eyes: "<circle cx='65' cy='70' r='6' fill='%230f172a'/><circle cx='95' cy='70' r='6' fill='%230f172a'/><circle cx='67' cy='68' r='2' fill='white'/><circle cx='97' cy='68' r='2' fill='white'/>",
  eyebrows: "<path d='M57 58l16-4M87 54l16 4' stroke='%23111827' stroke-width='5' stroke-linecap='round'/>",
  mouth: "<path d='M68 91c8 8 19 8 27 0' stroke='%237f1d1d' stroke-width='5' stroke-linecap='round' fill='none'/>",
  hair: "<path d='M42 66c4-29 22-44 45-42 25 3 38 22 34 48-14-15-31-22-53-16-9 2-18 5-26 10z' fill='%23111827'/>",
  facial_hair: "<path d='M58 87c10 12 34 12 44 0-3 19-41 19-44 0z' fill='%235b3a29' opacity='.88'/>",
  clothing: "<path d='M37 126c9-25 77-25 86 0v34H37z' fill='%230e7490'/><path d='M63 113l17 16 17-16' fill='none' stroke='%23cffafe' stroke-width='6' stroke-linecap='round' stroke-linejoin='round'/>",
  headwear: "<path d='M45 44h70l-7 26H52z' fill='%23facc15'/><path d='M57 42l8-16 15 14 15-14 8 16' fill='%23f59e0b'/>",
  glasses: "<rect x='52' y='62' width='24' height='16' rx='7' fill='none' stroke='%23bae6fd' stroke-width='5'/><rect x='84' y='62' width='24' height='16' rx='7' fill='none' stroke='%23bae6fd' stroke-width='5'/><path d='M76 70h8' stroke='%23bae6fd' stroke-width='4'/>",
  chess_accessory: "<circle cx='120' cy='115' r='18' fill='%23e0f2fe'/><path d='M112 126h16M116 112h8M114 118h12' stroke='%230f172a' stroke-width='5' stroke-linecap='round'/>"
};

function svgDataUri(category: AvatarCategory, color: string, label: string) {
  const safeLabel = label.replace(/[^A-Za-z0-9 ]/g, "");
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 160 160' role='img' aria-label='${safeLabel}'><rect width='160' height='160' rx='32' fill='transparent'/>${layerShapes[category]}<circle cx='132' cy='28' r='14' fill='${color}' opacity='.86'/></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function item(input: Omit<AvatarItem, "id" | "assetUrl" | "thumbnailUrl" | "isActive" | "isFeatured"> & { color: string; featured?: boolean }): AvatarItem {
  const assetUrl = svgDataUri(input.category, input.color, input.name);
  return {
    ...input,
    id: input.slug,
    price: getConfiguredAvatarPrice(input.slug, input.price, input.unlockType),
    assetUrl,
    thumbnailUrl: assetUrl,
    isActive: true,
    isFeatured: Boolean(input.featured)
  };
}

export const defaultAvatarItemSlugs = [
  "academy-face",
  "warm-skin-tone",
  "bright-quest-eyes",
  "steady-brows",
  "brave-smile",
  "rookie-hair",
  "academy-shirt",
  "starlit-board"
];

export const seedAvatarItems: AvatarItem[] = [
  item({ slug: "starlit-board", name: "Starlit Board", description: "A simple chessboard classroom backdrop.", category: "background", rarity: "Common", price: 0, layerOrder: 0, unlockType: "default", unlockRequirement: "Starter avatar item.", color: "%2367e8f9" }),
  item({ slug: "academy-face", name: "Academy Face", description: "A friendly cartoon student face.", category: "base_face", rarity: "Common", price: 0, layerOrder: 10, unlockType: "default", unlockRequirement: "Starter avatar item.", color: "%23fde68a" }),
  item({ slug: "warm-skin-tone", name: "Warm Skin Tone", description: "A warm starter skin tone layer.", category: "skin_tone", rarity: "Common", price: 0, layerOrder: 12, unlockType: "default", unlockRequirement: "Starter avatar item.", color: "%23fca5a5" }),
  item({ slug: "bright-quest-eyes", name: "Bright Quest Eyes", description: "Focused eyes ready for tactics.", category: "eyes", rarity: "Common", price: 0, layerOrder: 20, unlockType: "default", unlockRequirement: "Starter avatar item.", color: "%23bae6fd" }),
  item({ slug: "steady-brows", name: "Steady Brows", description: "Calm calculation eyebrows.", category: "eyebrows", rarity: "Common", price: 0, layerOrder: 22, unlockType: "default", unlockRequirement: "Starter avatar item.", color: "%23d9f99d" }),
  item({ slug: "brave-smile", name: "Brave Smile", description: "A confident academy smile.", category: "mouth", rarity: "Common", price: 0, layerOrder: 24, unlockType: "default", unlockRequirement: "Starter avatar item.", color: "%23fda4af" }),
  item({ slug: "rookie-hair", name: "Rookie Hair", description: "Starter hairstyle for new questers.", category: "hair", rarity: "Common", price: 0, layerOrder: 30, unlockType: "default", unlockRequirement: "Starter avatar item.", color: "%23c4b5fd" }),
  item({ slug: "academy-shirt", name: "Academy Shirt", description: "The classic Chess Academy shirt.", category: "clothing", rarity: "Common", price: 0, layerOrder: 40, unlockType: "default", unlockRequirement: "Starter avatar item.", color: "%2322d3ee" }),
  item({ slug: "pawn-cap", name: "Pawn Cap", description: "A clean cap for brave first moves.", category: "headwear", rarity: "Common", price: 5, layerOrder: 50, unlockType: "purchase", unlockRequirement: null, color: "%23a7f3d0", featured: true }),
  item({ slug: "chessboard-t-shirt", name: "Chessboard T-Shirt", description: "A casual shirt with board-square energy.", category: "clothing", rarity: "Common", price: 10, layerOrder: 40, unlockType: "purchase", unlockRequirement: null, color: "%23fef3c7" }),
  item({ slug: "bishop-glasses", name: "Bishop Glasses", description: "Diagonal vision with scholarly shine.", category: "glasses", rarity: "Common", price: 12, layerOrder: 55, unlockType: "purchase", unlockRequirement: null, color: "%23c4b5fd" }),
  item({ slug: "knight-headphones", name: "Knight Headphones", description: "Headphones shaped for tactical focus.", category: "headwear", rarity: "Uncommon", price: 20, layerOrder: 50, unlockType: "purchase", unlockRequirement: null, color: "%2393c5fd", featured: true }),
  item({ slug: "rook-backpack", name: "Rook Backpack", description: "Carry your prep like a fortress.", category: "chess_accessory", rarity: "Uncommon", price: 25, layerOrder: 60, unlockType: "purchase", unlockRequirement: null, color: "%23bfdbfe" }),
  item({ slug: "rapid-racer-goggles", name: "Rapid Racer Goggles", description: "Speedy goggles for rapid-game quests.", category: "glasses", rarity: "Uncommon", price: 35, layerOrder: 55, unlockType: "purchase", unlockRequirement: null, color: "%23fb7185", featured: true }),
  item({ slug: "puzzle-wizard-hat", name: "Puzzle Wizard Hat", description: "A wizard hat for puzzle streaks.", category: "headwear", rarity: "Rare", price: 40, layerOrder: 50, unlockType: "purchase", unlockRequirement: null, color: "%23a78bfa", featured: true }),
  item({ slug: "knight-helmet", name: "Knight Helmet", description: "A bold helmet for brave attackers.", category: "headwear", rarity: "Rare", price: 50, layerOrder: 50, unlockType: "purchase", unlockRequirement: null, color: "%23d1d5db" }),
  item({ slug: "queens-cape", name: "Queen's Cape", description: "A royal cape with attacking flair.", category: "clothing", rarity: "Rare", price: 65, layerOrder: 41, unlockType: "purchase", unlockRequirement: null, color: "%23f0abfc" }),
  item({ slug: "mini-rook-companion", name: "Mini Rook Companion", description: "A tiny rook buddy for your shoulder.", category: "chess_accessory", rarity: "Epic", price: 70, layerOrder: 60, unlockType: "purchase", unlockRequirement: null, color: "%23bae6fd" }),
  item({ slug: "checkmate-crown", name: "Checkmate Crown", description: "A crown for finishing attacks.", category: "headwear", rarity: "Epic", price: 90, layerOrder: 50, unlockType: "purchase", unlockRequirement: null, color: "%23facc15", featured: true }),
  item({ slug: "grandmaster-suit", name: "Grandmaster Suit", description: "Formal gear for tournament day.", category: "clothing", rarity: "Epic", price: 100, layerOrder: 40, unlockType: "purchase", unlockRequirement: null, color: "%23e5e7eb" }),
  item({ slug: "glowing-chess-eyes", name: "Glowing Chess Eyes", description: "Eyes that glow when tactics appear.", category: "eyes", rarity: "Epic", price: 110, layerOrder: 20, unlockType: "purchase", unlockRequirement: null, color: "%2367e8f9" }),
  item({ slug: "dark-king-armor", name: "Dark King Armor", description: "Boss-level armor with kingly pressure.", category: "clothing", rarity: "Legendary", price: 135, layerOrder: 40, unlockType: "purchase", unlockRequirement: null, color: "%237c3aed" }),
  item({ slug: "golden-grandmaster-aura", name: "Golden Grandmaster Aura", description: "A radiant aura for legendary progress.", category: "aura_effect", rarity: "Legendary", price: 150, layerOrder: 5, unlockType: "purchase", unlockRequirement: null, color: "%23fde047", featured: true })
];

export function getDefaultEquippedItems(items: AvatarItem[] = seedAvatarItems) {
  const equipped: Partial<Record<AvatarCategory, string>> = {};
  for (const slug of defaultAvatarItemSlugs) {
    const found = items.find((item) => item.slug === slug || item.id === slug);
    if (found) equipped[found.category] = found.id;
  }
  return equipped;
}

export function normalizeAvatarCategory(value: string): AvatarCategory {
  return avatarCategories.some((item) => item.id === value) ? value as AvatarCategory : "chess_accessory";
}

export function normalizeAvatarRarity(value: string): AvatarRarity {
  return avatarRarities.includes(value as AvatarRarity) ? value as AvatarRarity : "Common";
}

export function normalizeUnlockType(value: string): AvatarUnlockType {
  return avatarUnlockTypes.includes(value as AvatarUnlockType) ? value as AvatarUnlockType : "purchase";
}
