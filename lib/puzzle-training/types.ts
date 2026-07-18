export const puzzleThemeSlugs = ["mixed", "fork", "pin", "skewer", "mateIn1"] as const;
export const lichessPuzzleThemes = ["fork", "pin", "skewer", "mateIn1"] as const;

export type PuzzleThemeSlug = typeof puzzleThemeSlugs[number];
export type LichessPuzzleTheme = typeof lichessPuzzleThemes[number];
export type BoardOrientation = "white" | "black";

export type ChessPuzzleRow = {
  id: string;
  lichess_puzzle_id: string;
  initial_fen: string;
  moves: string[];
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
  token: string;
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
};

export type PuzzleMoveResult = {
  accepted: boolean;
  completed: boolean;
  token: string;
  studentFen?: string;
  positionFen: string;
  opponentMove?: string;
  completion?: PuzzleCompletionDetails;
  message: string;
};

export function parsePuzzleTheme(value: string | null): PuzzleThemeSlug {
  return puzzleThemeSlugs.includes(value as PuzzleThemeSlug) ? value as PuzzleThemeSlug : "mixed";
}
