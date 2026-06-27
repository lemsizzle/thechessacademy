import type { Badge, BadgeTier, ConceptTheme, TacticTheme } from "@/lib/types";

const createdAt = "2026-06-21";

const tierConfig = {
  Bronze: {
    requiredPuzzleCount: 10,
    xpValue: 10,
    visualTheme: "bronze glow, beginner magical emblem"
  },
  Silver: {
    requiredPuzzleCount: 20,
    xpValue: 30,
    visualTheme: "silver glow, polished magical emblem"
  },
  Gold: {
    requiredPuzzleCount: 30,
    xpValue: 40,
    visualTheme: "gold glow, heroic magical emblem"
  },
  Platinum: {
    requiredPuzzleCount: 40,
    xpValue: 100,
    visualTheme: "platinum radiant glow, legendary boss-level emblem"
  }
} satisfies Record<Extract<BadgeTier, "Bronze" | "Silver" | "Gold" | "Platinum">, { requiredPuzzleCount: number; xpValue: number; visualTheme: string }>;

export const tacticThemes: TacticTheme[] = [
  "Fork",
  "Pin",
  "Skewer",
  "Discovered Attack",
  "Double Attack",
  "Deflection",
  "Decoy",
  "Removing the Defender",
  "Back Rank Mate",
  "Mate in One"
];

const tacticSymbolism: Record<TacticTheme, string> = {
  Fork: "knight fork and two targets",
  Pin: "bishop ray pinning a defender to the king",
  Skewer: "rook beam driving a valuable piece away",
  "Discovered Attack": "revealed bishop line and hidden power",
  "Double Attack": "two glowing attack lines splitting from one piece",
  Deflection: "shield pulled away from a king",
  Decoy: "bait square and lured defender",
  "Removing the Defender": "broken shield and exposed piece",
  "Back Rank Mate": "trapped king behind pawns",
  "Mate in One": "final checkmate spark around the king"
};

export const tacticDescriptions: Record<TacticTheme, string> = {
  Fork: "Attack two or more pieces at the same time with one move.",
  Pin: "Freeze a piece because moving it would expose something more valuable behind it.",
  Skewer: "Attack a valuable piece first, forcing it to move and reveal a target behind it.",
  "Discovered Attack": "Move one piece out of the way to reveal a hidden attack from another piece.",
  "Double Attack": "Create two threats at once so the opponent cannot answer both.",
  Deflection: "Force a defender away from the square, piece, or job it must protect.",
  Decoy: "Lure an enemy piece onto a bad square where it can be attacked or trapped.",
  "Removing the Defender": "Capture or chase away the piece that protects your real target.",
  "Back Rank Mate": "Checkmate a king trapped on the back rank by its own pieces.",
  "Mate in One": "Find the single move that checkmates the king immediately."
};

export const conceptThemes: ConceptTheme[] = [
  "Opening Principles",
  "King Safety",
  "Piece Development",
  "Center Control",
  "Pawn Structure",
  "Passed Pawn",
  "Weak Squares",
  "Rook on the Seventh",
  "Opposition",
  "Endgame Technique"
];

const conceptConfig: Record<ConceptTheme, { description: string; xpValue: number; unlockRequirement: string; visualTheme: string }> = {
  "Opening Principles": {
    description: "Unlocked by showing strong opening habits in your games. You are building your chess foundation like a true academy student.",
    xpValue: 50,
    unlockRequirement: "Demonstrate the main opening principles in a game: control the center, develop pieces, castle, and avoid early queen adventures.",
    visualTheme: "glowing chessboard opening scroll, center squares highlighted, developing pieces"
  },
  "King Safety": {
    description: "Unlocked by keeping your king protected and calm. Safe kings make brave attacks possible.",
    xpValue: 50,
    unlockRequirement: "Show strong king safety by castling, avoiding unnecessary pawn weaknesses, and keeping the king protected.",
    visualTheme: "protected king behind a glowing shield and castle wall"
  },
  "Piece Development": {
    description: "Unlocked by bringing your pieces into the game with purpose. Your army is waking up fast.",
    xpValue: 50,
    unlockRequirement: "Develop all minor pieces actively and connect the rooks in a game.",
    visualTheme: "knights and bishops moving from their starting squares with magical trails"
  },
  "Center Control": {
    description: "Unlocked by fighting for the heart of the board. You are learning where chess power begins.",
    xpValue: 50,
    unlockRequirement: "Use pawns and pieces to fight for the center and explain why the center matters.",
    visualTheme: "four center squares glowing with strategic energy"
  },
  "Pawn Structure": {
    description: "Unlocked by spotting the hidden story in the pawns. Small pieces can shape the whole game.",
    xpValue: 75,
    unlockRequirement: "Identify doubled pawns, isolated pawns, pawn chains, and weak pawns in a position.",
    visualTheme: "connected pawn chain forming a magical fortress"
  },
  "Passed Pawn": {
    description: "Unlocked by creating or guiding a hero pawn. Every passed pawn dreams of promotion.",
    xpValue: 75,
    unlockRequirement: "Create or correctly use a passed pawn in a game or lesson position.",
    visualTheme: "hero pawn marching forward with radiant path"
  },
  "Weak Squares": {
    description: "Unlocked by finding squares your opponent cannot easily protect. Strategy is starting to glow.",
    xpValue: 75,
    unlockRequirement: "Identify and use a weak square that cannot easily be defended by enemy pawns.",
    visualTheme: "cracked glowing square on a chessboard, strategic target energy"
  },
  "Rook on the Seventh": {
    description: "Unlocked by placing a rook where it can pressure pawns and trap the king. That rook means business.",
    xpValue: 75,
    unlockRequirement: "Place a rook on the seventh rank and use it to attack pawns, trap the king, or create pressure.",
    visualTheme: "rook standing on a glowing seventh-rank bridge, attacking pawns"
  },
  Opposition: {
    description: "Unlocked by using king power in the endgame. You are learning the quiet moves that win.",
    xpValue: 100,
    unlockRequirement: "Demonstrate opposition in a king and pawn endgame.",
    visualTheme: "two kings facing each other with a magical boundary line"
  },
  "Endgame Technique": {
    description: "Unlocked by converting a winning endgame with patience and precision. Calm technique is a superpower.",
    xpValue: 100,
    unlockRequirement: "Convert a basic winning endgame using careful king activity, pawn play, and technique.",
    visualTheme: "king and pawn endgame scroll with calm precise energy"
  }
};

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

export function createConceptBadge(conceptTheme: ConceptTheme): Badge {
  const config = conceptConfig[conceptTheme];
  return {
    id: `concept-${slugify(conceptTheme)}`,
    name: conceptTheme,
    description: config.description,
    category: "Concepts",
    conceptTheme,
    xpValue: config.xpValue,
    unlockRequirement: config.unlockRequirement,
    visualTheme: config.visualTheme,
    artImageUrl: null,
    finalImageUrl: null,
    generationStatus: "pending",
    isActive: true,
    isLegacy: false,
    createdAt
  };
}

export function createTacticBadgeSet(tacticTheme: TacticTheme, displayName = tacticTheme): Badge[] {
  return (Object.entries(tierConfig) as Array<[Extract<BadgeTier, "Bronze" | "Silver" | "Gold" | "Platinum">, typeof tierConfig.Bronze]>).map(([tier, config]) => ({
    id: `tactic-${slugify(tacticTheme)}-${tier.toLowerCase()}`,
    name: `${displayName} ${tier}`,
    description: tacticDescriptions[tacticTheme],
    category: "Tactics",
    tacticTheme,
    tier,
    xpValue: config.xpValue,
    unlockRequirement: `Solve ${config.requiredPuzzleCount} ${displayName.toLowerCase()} puzzles.`,
    requiredPuzzleCount: config.requiredPuzzleCount,
    visualTheme: `${config.visualTheme}, ${tacticSymbolism[tacticTheme]}`,
    artImageUrl: null,
    finalImageUrl: null,
    generationStatus: "pending",
    isActive: true,
    isLegacy: false,
    createdAt
  }));
}

export const tacticBadges: Badge[] = tacticThemes.flatMap((theme) => createTacticBadgeSet(theme));
export const conceptBadges: Badge[] = conceptThemes.map((theme) => createConceptBadge(theme));
export const badges: Badge[] = [...tacticBadges, ...conceptBadges];

export const legacyBadges: Badge[] = [
  ["fork-apprentice", "Fork Apprentice", "Spot a basic fork and win material.", "Tactics", "C", 40, "Solve 5 fork puzzles.", "bronze knight fork sparks"],
  ["fork-master", "Fork Master", "Use forks confidently in class games.", "Tactics", "A", 120, "Find 10 forks in games or puzzles.", "gold knight lightning split"],
  ["discovered-attack", "Discovered Attack", "Reveal an attack by moving with purpose.", "Tactics", "B", 80, "Demonstrate 3 discovered attacks.", "silver bishop moon beam"],
  ["deflection", "Deflection", "Pull a defender away from duty.", "Tactics", "B", 80, "Solve 6 deflection puzzles.", "blue rook shield magic"],
  ["back-rank-mate", "Back Rank Mate", "Trap the king on the final rank.", "Checkmates", "B", 90, "Deliver or explain a back rank mate.", "castle wall checkmate glow"],
  ["two-bishop-checkmate", "Two Bishop Checkmate", "Coordinate bishops to finish the game.", "Checkmates", "A", 140, "Complete the two bishop mate drill.", "twin bishop radiant lattice"],
  ["pawn-promotion", "Pawn Promotion", "Escort a pawn to become a hero.", "Endgames", "C", 50, "Promote a pawn in a game or drill.", "green pawn ascension aura"],
  ["underpromotion-legend", "Underpromotion Legend", "Choose the rare promotion that wins.", "Creativity", "S", 220, "Find an underpromotion tactic.", "legendary pawn phoenix crown"],
  ["comeback-king", "Comeback King", "Stay calm and turn the game around.", "Sportsmanship", "A", 130, "Win or draw after being behind material.", "gold king comeback flame"],
  ["hand-and-brain-hero", "Hand and Brain Hero", "Communicate clearly with a teammate.", "Sportsmanship", "B", 75, "Complete a hand-and-brain challenge.", "two hands chess aura"],
  ["opening-principles", "Opening Principles", "Develop, control the center, and castle.", "Openings", "C", 45, "Play 3 games with sound opening habits.", "bronze academy scroll"],
  ["endgame-survivor", "Endgame Survivor", "Convert simple endings with patience.", "Endgames", "B", 95, "Win a king and pawn endgame drill.", "blue king endgame lantern"],
  ["calm-under-pressure", "Calm Under Pressure", "Think clearly when the clock feels loud.", "Tournament", "A", 150, "Complete a timed puzzle set calmly.", "purple clock discipline aura"],
  ["puzzle-streak", "Puzzle Streak", "Build a tactical training streak.", "Tactics", "C", 55, "Solve puzzles in 3 consecutive classes.", "emerald puzzle flame"],
  ["tournament-warrior", "Tournament Warrior", "Show courage across a full event.", "Tournament", "S", 250, "Finish a tournament with strong focus.", "radiant warrior queen crest"]
].map(([id, name, description, category, tier, xpValue, unlockRequirement, visualTheme]) => ({
  id,
  name,
  description,
  category,
  tier,
  xpValue,
  unlockRequirement,
  visualTheme,
  artImageUrl: null,
  finalImageUrl: null,
  generationStatus: "idle",
  isActive: false,
  isLegacy: true,
  createdAt
})) as Badge[];

export const allBadges: Badge[] = [...badges, ...legacyBadges];
