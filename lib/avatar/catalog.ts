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

function layerShape(category: AvatarCategory, slug: string, accent: string) {
  const defaults: Record<AvatarCategory, string> = {
    background: "<rect width='160' height='160' rx='28' fill='#172554'/><circle cx='25' cy='28' r='2' fill='#fde68a'/><circle cx='132' cy='39' r='3' fill='#bae6fd'/><circle cx='114' cy='19' r='2' fill='#fff'/><path d='M0 119h160v41H0z' fill='#0f172a'/><path d='M0 119h20v20H0zm40 0h20v20H40zm40 0h20v20H80zm40 0h20v20h-20zM20 139h20v21H20zm40 0h20v21H60zm40 0h20v21h-20zm40 0h20v21h-20z' fill='#334155'/>",
    aura_effect: `<circle cx='80' cy='76' r='60' fill='none' stroke='${accent}' stroke-width='7' opacity='.72'/><path d='M80 4l5 12 13 1-10 8 3 13-11-7-11 7 3-13-10-8 13-1zM22 63l4 8 9 1-7 6 2 9-8-5-8 5 2-9-7-6 9-1zM138 63l4 8 9 1-7 6 2 9-8-5-8 5 2-9-7-6 9-1z' fill='${accent}' opacity='.9'/>`,
    base_face: "<circle cx='38' cy='75' r='10' fill='#f2b892'/><circle cx='122' cy='75' r='10' fill='#f2b892'/><rect x='67' y='101' width='26' height='27' rx='10' fill='#e7a77f'/><circle cx='80' cy='72' r='43' fill='#f8c9a8'/>",
    skin_tone: `<circle cx='38' cy='75' r='7' fill='${accent}'/><circle cx='122' cy='75' r='7' fill='${accent}'/><circle cx='80' cy='72' r='39' fill='${accent}' opacity='.96'/>`,
    eyes: "<ellipse cx='64' cy='70' rx='8' ry='7' fill='white'/><ellipse cx='96' cy='70' rx='8' ry='7' fill='white'/><circle cx='65' cy='71' r='4' fill='#172554'/><circle cx='95' cy='71' r='4' fill='#172554'/><circle cx='66' cy='69' r='1.5' fill='white'/><circle cx='96' cy='69' r='1.5' fill='white'/>",
    eyebrows: "<path d='M55 58q10-6 19 0M86 58q10-6 19 0' stroke='#713f12' stroke-width='4' stroke-linecap='round' fill='none'/>",
    mouth: "<path d='M67 91q13 14 27 0' fill='#fff' stroke='#9f1239' stroke-width='4' stroke-linejoin='round'/>",
    hair: "<path d='M39 66q1-45 42-45 37 0 42 42-11-5-18-17-15 12-34 5-14-5-32 15z' fill='#3f2a1d'/><path d='M44 60q8-27 29-31' fill='none' stroke='#6b442c' stroke-width='5' stroke-linecap='round'/>",
    facial_hair: "<path d='M61 86q19 15 38 0-2 24-19 24T61 86z' fill='#5b3a29' opacity='.9'/>",
    clothing: `<path d='M31 160v-28q5-25 36-25l13 14 13-14q31 0 36 25v28z' fill='${accent}'/><path d='M64 110l16 14 16-14' fill='none' stroke='#e0f2fe' stroke-width='5' stroke-linecap='round' stroke-linejoin='round'/>`,
    headwear: `<path d='M40 48q5-28 40-28t40 28v9H40z' fill='${accent}'/><path d='M42 53h82q-8 12-29 7H42z' fill='#0f172a' opacity='.28'/>`,
    glasses: `<rect x='50' y='61' width='27' height='19' rx='8' fill='#bae6fd' fill-opacity='.18' stroke='${accent}' stroke-width='4'/><rect x='83' y='61' width='27' height='19' rx='8' fill='#bae6fd' fill-opacity='.18' stroke='${accent}' stroke-width='4'/><path d='M77 69h6' stroke='${accent}' stroke-width='4'/>`,
    chess_accessory: `<circle cx='124' cy='116' r='21' fill='${accent}' stroke='#fff' stroke-width='3'/><path d='M114 130h20M117 121h14M119 106h10l-2 9h-6z' stroke='#172554' stroke-width='4' stroke-linecap='round' stroke-linejoin='round' fill='none'/>`
  };

  const variants: Record<string, string> = {
    "long-flowing-hair": `<path d='M37 66q0-47 43-47 42 0 43 47l12 66-29 7-9-72q-17-10-34 0l-9 72-29-7z' fill='${accent}'/><path d='M42 61q8-32 35-36M118 61q-8-32-35-36' fill='none' stroke='#8b5e3c' stroke-width='5' stroke-linecap='round' opacity='.75'/>`,
    "knight-headphones": `<path d='M42 68q0-42 38-42t38 42' fill='none' stroke='${accent}' stroke-width='9'/><rect x='34' y='62' width='18' height='31' rx='8' fill='${accent}'/><rect x='108' y='62' width='18' height='31' rx='8' fill='${accent}'/><path d='M117 90q-4 18-19 18' fill='none' stroke='${accent}' stroke-width='5' stroke-linecap='round'/>`,
    "puzzle-wizard-hat": `<path d='M49 51L75 4q4-7 9 1l28 46z' fill='${accent}' stroke='#c4b5fd' stroke-width='3'/><path d='M76 7q12 24 5 44' fill='none' stroke='#fef3c7' stroke-width='3'/><path d='M36 50q44-11 88 0l-7 13H43z' fill='#6d28d9'/><circle cx='82' cy='25' r='4' fill='#fde68a'/>`,
    "knight-helmet": `<path d='M43 67V47q0-29 37-29t37 29v20l-17-10-20 10-20-10z' fill='${accent}' stroke='#64748b' stroke-width='4'/><path d='M80 18v49M51 49h58' stroke='#f8fafc' stroke-width='4' opacity='.75'/><path d='M95 23l13-9-2 18' fill='#ef4444'/>`,
    "checkmate-crown": `<path d='M43 57l4-31 22 16 11-27 11 27 22-16 4 31z' fill='${accent}' stroke='#fef3c7' stroke-width='3'/><path d='M43 57h74v12H43z' fill='#f59e0b'/><circle cx='47' cy='25' r='4' fill='#67e8f9'/><circle cx='80' cy='14' r='4' fill='#fda4af'/><circle cx='113' cy='25' r='4' fill='#67e8f9'/>`,
    "bishop-glasses": `<path d='M49 63l29-4-4 22-21-1zM111 63l-29-4 4 22 21-1z' fill='#cffafe' fill-opacity='.3' stroke='${accent}' stroke-width='4'/><path d='M78 68h4' stroke='${accent}' stroke-width='4'/>`,
    "rapid-racer-goggles": `<path d='M45 67q17-15 34 0l-6 15H50zM115 67q-17-15-34 0l6 15h23z' fill='${accent}' stroke='#fff' stroke-width='3'/><path d='M79 70h2M45 69l-12-6M115 69l12-6' stroke='#fff' stroke-width='4' stroke-linecap='round'/>`,
    "chessboard-t-shirt": `<path d='M31 160v-28q5-25 36-25l13 14 13-14q31 0 36 25v28z' fill='${accent}'/><path d='M68 128h12v12H68zm12 12h12v12H80zm12-12h12v12H92zm-24 24h12v8H68zm24 0h12v8H92z' fill='#0f172a'/>`,
    "queens-cape": `<path d='M46 111q-17 12-22 49h112q-5-37-22-49l-20 17-14-7-14 7z' fill='${accent}'/><path d='M62 111q18 16 36 0' fill='none' stroke='#fef3c7' stroke-width='6'/><circle cx='80' cy='120' r='6' fill='#fde047'/>`,
    "grandmaster-suit": "<path d='M31 160v-28q5-25 36-25l13 14 13-14q31 0 36 25v28z' fill='#1e293b'/><path d='M62 109l18 18 18-18-8 51H70z' fill='#f8fafc'/><path d='M74 121l6 6 6-6 5 22-11 9-11-9z' fill='#7c3aed'/>",
    "dark-king-armor": "<path d='M27 160v-29l21-22 21 8 11 11 11-11 21-8 21 22v29z' fill='#111827' stroke='#7c3aed' stroke-width='4'/><path d='M48 109l-9 18 25 4M112 109l9 18-25 4' fill='#312e81' stroke='#a78bfa' stroke-width='4'/><path d='M73 129h14v19H73z' fill='#7c3aed'/>",
    "rook-backpack": `<path d='M105 91q24 1 29 21v35h-39v-35q1-15 10-21z' fill='${accent}' stroke='#334155' stroke-width='4'/><path d='M101 102h28M105 91v-8h20v8M104 125h21' stroke='#fff' stroke-width='4'/><path d='M100 116q-15-3-12 21' fill='none' stroke='#334155' stroke-width='5'/>`,
    "mini-rook-companion": `<circle cx='126' cy='116' r='25' fill='${accent}' stroke='#fff' stroke-width='3'/><path d='M113 133h26M117 124h18l-3-20h-4v7h-5v-7h-5v7h-4z' fill='#e0f2fe' stroke='#172554' stroke-width='3' stroke-linejoin='round'/><circle cx='120' cy='118' r='2' fill='#172554'/><circle cx='130' cy='118' r='2' fill='#172554'/>`,
    "glowing-chess-eyes": `<ellipse cx='64' cy='70' rx='10' ry='8' fill='${accent}' opacity='.55'/><ellipse cx='96' cy='70' rx='10' ry='8' fill='${accent}' opacity='.55'/><circle cx='64' cy='70' r='5' fill='#fff'/><circle cx='96' cy='70' r='5' fill='#fff'/><path d='M45 70h-12M115 70h12' stroke='${accent}' stroke-width='4' stroke-linecap='round'/>`
  };

  return variants[slug] ?? defaults[category];
}

function decodeSvgColor(value: string) {
  return value.replace(/^%23/i, "#");
}

function svgDataUri(category: AvatarCategory, color: string, label: string, slug: string) {
  const safeLabel = label.replace(/[^A-Za-z0-9 ]/g, "");
  const accent = decodeSvgColor(color);
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 160 160' role='img' aria-label='${safeLabel}'><rect width='160' height='160' rx='28' fill='transparent'/>${layerShape(category, slug, accent)}</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function item(input: Omit<AvatarItem, "id" | "assetUrl" | "thumbnailUrl" | "isActive" | "isFeatured"> & { color: string; featured?: boolean }): AvatarItem {
  const assetUrl = svgDataUri(input.category, input.color, input.name, input.slug);
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
  "starlit-board",
  "academy-face",
  "warm-skin-tone",
  "bright-quest-eyes",
  "brave-smile",
  "academy-shirt"
];

export const seedAvatarItems: AvatarItem[] = [
  item({ slug: "starlit-board", name: "Starlit Board", description: "A simple chessboard classroom backdrop.", category: "background", rarity: "Common", price: 0, layerOrder: 0, unlockType: "default", unlockRequirement: "Starter avatar item.", color: "%2367e8f9" }),
  item({ slug: "academy-face", name: "Academy Face", description: "A friendly cartoon student face.", category: "base_face", rarity: "Common", price: 0, layerOrder: 10, unlockType: "default", unlockRequirement: "Starter avatar item.", color: "%23fde68a" }),
  item({ slug: "light-skin-tone", name: "Light Skin Tone", description: "A light skin tone, always free to use.", category: "skin_tone", rarity: "Common", price: 0, layerOrder: 12, unlockType: "default", unlockRequirement: "Free core avatar choice.", color: "%23f3c9ad" }),
  item({ slug: "warm-skin-tone", name: "Warm Skin Tone", description: "A warm starter skin tone layer.", category: "skin_tone", rarity: "Common", price: 0, layerOrder: 12, unlockType: "default", unlockRequirement: "Starter avatar item.", color: "%23c98b68" }),
  item({ slug: "deep-skin-tone", name: "Deep Skin Tone", description: "A deep skin tone, always free to use.", category: "skin_tone", rarity: "Common", price: 0, layerOrder: 12, unlockType: "default", unlockRequirement: "Free core avatar choice.", color: "%2370432f" }),
  item({ slug: "bright-quest-eyes", name: "Bright Quest Eyes", description: "Focused eyes ready for tactics.", category: "eyes", rarity: "Common", price: 0, layerOrder: 20, unlockType: "default", unlockRequirement: "Starter avatar item.", color: "%23bae6fd" }),
  item({ slug: "steady-brows", name: "Steady Brows", description: "Calm calculation eyebrows.", category: "eyebrows", rarity: "Common", price: 5, layerOrder: 22, unlockType: "purchase", unlockRequirement: null, color: "%23d9f99d" }),
  item({ slug: "brave-smile", name: "Brave Smile", description: "A confident academy smile.", category: "mouth", rarity: "Common", price: 0, layerOrder: 24, unlockType: "default", unlockRequirement: "Starter avatar item.", color: "%23fda4af" }),
  item({ slug: "rookie-hair", name: "Rookie Hair", description: "A neat short hairstyle for new questers.", category: "hair", rarity: "Common", price: 8, layerOrder: 30, unlockType: "purchase", unlockRequirement: null, color: "%233f2a1d" }),
  item({ slug: "long-flowing-hair", name: "Long Flowing Hair", description: "A long hairstyle that frames the face and falls over the shoulders.", category: "hair", rarity: "Common", price: 10, layerOrder: 30, unlockType: "purchase", unlockRequirement: null, color: "%235b3a29", featured: true }),
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
