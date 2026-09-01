import {
  SURVIVAL_PUZZLE_LIMIT,
  WOODPECKER_CYCLE_COUNT,
  WOODPECKER_SET_SIZE_OPTIONS
} from "@/lib/puzzle-training/modes";

export type PuzzleModeChoice = "daily" | "survival" | "woodpecker" | "starWars" | "hideAndSeek" | "adaptiveReview";
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
    summary: "One-star moves · score attack",
    description: "Every move must land a non-pawn piece on exactly one star while keeping another star reachable. A miss or dead end ends the run.",
    startLabel: "Launch Star Wars"
  },
  {
    id: "hideAndSeek",
    name: "Hide and Seek",
    icon: "✦",
    summary: "Classic or 60-second Time Trial",
    description: "Find every empty square the black pieces cannot see. Choose an open-ended search or race a 60-second clock; speed can earn up to 40% of your score.",
    startLabel: "Start Hide and Seek"
  },
  {
    id: "adaptiveReview",
    name: "Learn From Your Mistakes",
    icon: "↺",
    summary: "Games + Survival · spaced review",
    description: "Turn mistakes from analyzed games and Survival training into personal puzzles. Positions return when they are due until the stronger move becomes automatic.",
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

export function puzzleLauncherDismissAction(screen: PuzzleLauncherScreen): PuzzleLauncherAction {
  return screen === "choices" ? { type: "CLOSE" } : { type: "BACK" };
}

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
