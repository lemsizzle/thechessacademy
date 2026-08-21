export const lichessPuzzleThemes = [
  "fork",
  "pin",
  "skewer",
  "mateIn1",
  "mateIn2",
  "mateIn3",
  "backRankMate",
  "discoveredAttack",
  "doubleCheck",
  "deflection",
  "attraction",
  "clearance",
  "interference",
  "xRayAttack",
  "trappedPiece",
  "hangingPiece",
  "sacrifice",
  "advancedPawn",
  "promotion",
  "quietMove",
  "defensiveMove",
  "exposedKing",
  "kingsideAttack"
] as const;
export const puzzleThemeSlugs = ["mixed", ...lichessPuzzleThemes] as const;
export const puzzleLevelSlugs = ["all", "beginner", "improver", "intermediate", "advanced"] as const;

export type PuzzleThemeSlug = typeof puzzleThemeSlugs[number];
export type LichessPuzzleTheme = typeof lichessPuzzleThemes[number];
export type PuzzleLevelSlug = typeof puzzleLevelSlugs[number];
export type BoardOrientation = "white" | "black";
export type PuzzleStartMode = "after_setup" | "direct";
export type PuzzleSourceKind = "lichess" | "study";

export const puzzleThemeOptions: ReadonlyArray<{ id: PuzzleThemeSlug; name: string; description: string }> = [
  { id: "mixed", name: "Mixed tactics", description: "A shuffled selection from every Academy tactic." },
  { id: "advancedPawn", name: "Advanced pawn", description: "Use or stop a pawn deep in enemy territory." },
  { id: "attraction", name: "Attraction", description: "Draw a piece onto a vulnerable square." },
  { id: "backRankMate", name: "Back-rank mate", description: "Exploit a king trapped behind its own pawns." },
  { id: "clearance", name: "Clearance", description: "Open a square, rank, file, or diagonal for another piece." },
  { id: "defensiveMove", name: "Defensive move", description: "Find the only move that holds the position." },
  { id: "deflection", name: "Deflection", description: "Force a defender away from an important duty." },
  { id: "discoveredAttack", name: "Discovered attack", description: "Move one piece to reveal an attack by another." },
  { id: "doubleCheck", name: "Double check", description: "Give check with two pieces at the same time." },
  { id: "exposedKing", name: "Exposed king", description: "Attack a king with too little shelter." },
  { id: "fork", name: "Fork", description: "Attack two or more targets with one piece." },
  { id: "hangingPiece", name: "Hanging piece", description: "Win a piece that is undefended or insufficiently defended." },
  { id: "interference", name: "Interference", description: "Block the line between a defender and its target." },
  { id: "kingsideAttack", name: "Kingside attack", description: "Build a tactical attack against the castled king." },
  { id: "mateIn1", name: "Mate in 1", description: "Find the move that checkmates immediately." },
  { id: "mateIn2", name: "Mate in 2", description: "Force checkmate on your second move." },
  { id: "mateIn3", name: "Mate in 3", description: "Calculate a forced checkmate three moves ahead." },
  { id: "pin", name: "Pin", description: "Exploit a piece that cannot safely move." },
  { id: "promotion", name: "Promotion", description: "Use a pawn promotion to decide the position." },
  { id: "quietMove", name: "Quiet move", description: "Find a powerful move that is neither a check nor capture." },
  { id: "sacrifice", name: "Sacrifice", description: "Give up material for a stronger tactical gain." },
  { id: "skewer", name: "Skewer", description: "Attack a valuable piece and win what stands behind it." },
  { id: "trappedPiece", name: "Trapped piece", description: "Catch a piece that has no safe escape." },
  { id: "xRayAttack", name: "X-ray attack", description: "Attack through another piece along a line." }
];

export type ChessPuzzleRow = {
  id: string;
  lichess_puzzle_id: string;
  initial_fen: string;
  moves: string[];
  start_mode: PuzzleStartMode;
  accepted_moves: string[];
  source_kind: PuzzleSourceKind;
  source_study_id: string | null;
  source_chapter_id: string | null;
  source_node_id: string | null;
  teacher_prompt: string;
  rating: number | null;
  rating_deviation: number | null;
  popularity: number | null;
  number_of_plays: number | null;
  themes: string[];
  game_url: string | null;
  opening_tags: string[];
  random_key: number;
  is_active: boolean;
};

export type PublicTrainingPuzzle = {
  id: string;
  displayFen: string;
  orientation: BoardOrientation;
  sideToMove: "White" | "Black";
  prompt: string;
  sourceKind: PuzzleSourceKind;
  token: string;
  daily: {
    date: string;
    rewardClaimed: boolean;
    xp: number;
    coins: number;
  } | null;
};

export type PuzzleMoveInput = {
  from: string;
  to: string;
  promotion?: "q" | "r" | "b" | "n";
};

export type PuzzleCompletionDetails = {
  themes: string[];
  rating: number | null;
  gameUrl: string | null;
  mistakes: number;
  hintsUsed: number;
  elapsedSeconds: number;
  dailyReward?: {
    awarded: boolean;
    xpAwarded: number;
    coinsAwarded: number;
  };
};

export type PuzzleMoveResult = {
  accepted: boolean;
  completed: boolean;
  token: string;
  studentFen?: string;
  positionFen: string;
  opponentMove?: string;
  completion?: PuzzleCompletionDetails;
  nextPuzzle?: PublicTrainingPuzzle;
  message: string;
};

export function parsePuzzleTheme(value: string | null): PuzzleThemeSlug {
  return puzzleThemeSlugs.includes(value as PuzzleThemeSlug) ? value as PuzzleThemeSlug : "mixed";
}

export function parsePuzzleLevel(value: string | null): PuzzleLevelSlug {
  return puzzleLevelSlugs.includes(value as PuzzleLevelSlug) ? value as PuzzleLevelSlug : "all";
}

export function puzzleLevelRatingRange(level: PuzzleLevelSlug) {
  switch (level) {
    case "beginner":
      return { minimum: 600, maximum: 999 };
    case "improver":
      return { minimum: 1000, maximum: 1399 };
    case "intermediate":
      return { minimum: 1400, maximum: 1799 };
    case "advanced":
      return { minimum: 1800, maximum: 2200 };
    default:
      return null;
  }
}
