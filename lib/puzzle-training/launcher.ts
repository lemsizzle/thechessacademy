import {
  SURVIVAL_PUZZLE_LIMIT,
  WOODPECKER_CYCLE_COUNT,
  WOODPECKER_SET_SIZE_OPTIONS
} from "@/lib/puzzle-training/modes";

export type PuzzleModeChoice = "daily" | "survival" | "woodpecker" | "starWars" | "adaptiveReview";
export type PuzzleLauncherScreen = "choices" | "details" | "stats";

export type PuzzleModeOption = {
  id: PuzzleModeChoice;
  name: string;
  icon: string;
  summary: string;
  description: string;
  startLabel: string;
};

export const PUZZLE_MODE_OPTIONS: ReadonlyArray<PuzzleModeOption> = [
  {
    id: "survival",
    name: "Survival",
    icon: "♥",
    summary: `${SURVIVAL_PUZZLE_LIMIT} puzzles · 3 lives`,
    description: "Begin with very easy puzzles and climb through five difficulty stages. One mistake costs a life, so protect all three for as long as you can.",
    startLabel: "Start Survival"
  },
  {
    id: "woodpecker",
    name: "Woodpecker Method",
    icon: "↻",
    summary: `${WOODPECKER_CYCLE_COUNT} cycles · ${WOODPECKER_SET_SIZE_OPTIONS[0]}–${WOODPECKER_SET_SIZE_OPTIONS.at(-1)} puzzles`,
    description: "Repeat the same puzzle set in a new order each cycle. Track speed and accuracy, then review mistakes before the next pass.",
    startLabel: "Start Woodpecker"
  },
  {
    id: "daily",
    name: "Puzzle of the Day",
    icon: "☀",
    summary: "1 shared puzzle · daily reward",
    description: "Solve today’s shared Academy challenge. The first successful solve each day awards 10 XP and 10 Academy Coins.",
    startLabel: "Play Daily Puzzle"
  },
  {
    id: "starWars",
    name: "Star Wars",
    icon: "★",
    summary: "Route planning · score attack",
    description: "Plan the complete route before moving. Every move must land a non-pawn piece on exactly one star; the first missed star ends the run.",
    startLabel: "Launch Star Wars"
  },
  {
    id: "adaptiveReview",
    name: "Learn From Your Mistakes",
    icon: "↺",
    summary: "Your games · spaced review",
    description: "Turn mistakes from analyzed games into personal puzzles. Positions return when they are due until the stronger move becomes automatic.",
    startLabel: "Start Mistake Review"
  }
];

export type PuzzleLauncherState = {
  open: boolean;
  screen: PuzzleLauncherScreen;
  selectedMode: PuzzleModeChoice | null;
};

export type PuzzleLauncherAction =
  | { type: "OPEN_CHOICES" }
  | { type: "OPEN_STATS" }
  | { type: "SELECT_MODE"; mode: PuzzleModeChoice }
  | { type: "BACK" }
  | { type: "CLOSE" };

export const initialPuzzleLauncherState: PuzzleLauncherState = {
  open: true,
  screen: "choices",
  selectedMode: null
};

export function puzzleLauncherReducer(
  state: PuzzleLauncherState,
  action: PuzzleLauncherAction
): PuzzleLauncherState {
  if (action.type === "OPEN_CHOICES") return { open: true, screen: "choices", selectedMode: null };
  if (action.type === "OPEN_STATS") return { open: true, screen: "stats", selectedMode: null };
  if (action.type === "SELECT_MODE") return { open: true, screen: "details", selectedMode: action.mode };
  if (action.type === "BACK") return { ...state, open: true, screen: "choices", selectedMode: null };
  return { ...state, open: false, screen: "choices", selectedMode: null };
}
