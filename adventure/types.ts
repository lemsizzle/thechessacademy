export type AdventureDifficulty = "beginner" | "pieces" | "some" | "experienced";

export type AdventureInventoryItem = "hint-charm";

export type AdventureProgress = {
  version: number;
  started: boolean;
  currentSceneId: string;
  difficulty: AdventureDifficulty | null;
  completedChallengeIds: string[];
  unlockedKnowledgeIds: string[];
  inventory: Partial<Record<AdventureInventoryItem, number>>;
  puzzleRatings: Record<string, AdventurePuzzleRating>;
  prototypeCoins: number;
  chapterComplete: boolean;
  /** Scene visits power lightweight story conditions without creating a second state engine. */
  visitedSceneIds: string[];
  /** Named story facts set by scene entry and available to conditional hotspots. */
  storyFlags: Record<string, boolean>;
};

export type AdventureMove = {
  from: string;
  to: string;
  promotion?: "q" | "r" | "b" | "n";
};

export type AdventureReward = {
  coins?: number;
  item?: AdventureInventoryItem;
  itemAmount?: number;
};

export type AdventureLessonPiece = "pawn" | "rook" | "bishop" | "queen" | "king" | "knight";

export type AdventurePuzzleRating = {
  bestMoves: number;
  stars: 1 | 2 | 3;
};

export type AdventureStarTrail = {
  piece: AdventureLessonPiece;
  /** One or more copies of the taught piece. A learner may move any of them. */
  startSquares: string[];
  /** Star locations are enemy-piece placeholders; any legal route can collect them. */
  starSquares: string[];
  /** The shortest-route score target for this course board. */
  parMoves: number;
  /** Temporary guidance shown on a concept's introductory board. */
  hintArrows?: Array<{ from: string; to: string; color?: string }>;
};

/** A reusable non-piece-movement exercise used by the Fundamentals chapter. */
export type AdventureFundamentalExercise = {
  goal: "capture-all" | "safe-move" | "escape-check" | "check" | "checkmate";
  /** The source lesson's intended move count, used for local ratings. */
  parMoves: number;
};

export type AdventurePuzzle = {
  id: string;
  objective: string;
  concept: string;
  fen: string;
  expectedMove?: AdventureMove;
  successMessage: string;
  hint: string;
  /** Optional rule-specific feedback for an illegal teaching attempt. */
  illegalMoveMessage?: string;
  /** Squares that hold Pawnhaven's glowing practice stars. */
  shinySquares?: string[];
  /** A no-opponent, one-piece movement lesson. */
  starTrail?: AdventureStarTrail;
  /** A multi-piece Fundamentals exercise with ordinary legal chess movement. */
  fundamental?: AdventureFundamentalExercise;
  /** Teaching arrows that appear without being part of the student's own drawings. */
  hintArrows?: Array<{ from: string; to: string; color?: string }>;
  /** Piece types added only to make a kingless lesson position legal for chess.js. */
  hiddenPieces?: string[];
  /** Visible player pieces that may be selected on a kingless lesson board. */
  movableSquares?: string[];
  /** Original visible black pieces allowed to make an automatic lesson reply. */
  opponentSquares?: string[];
  /** Original public lesson position before hidden legal-engine king support is added. */
  sourceFen?: string;
  expectedResult?: "check" | "checkmate" | "stalemate";
};

export type AdventureChallenge = {
  id: string;
  title: string;
  chapterLabel: string;
  puzzles: AdventurePuzzle[];
  knowledgeIds: string[];
  reward?: AdventureReward;
  /** Story facts recorded once the existing challenge is completed. */
  completionFlags?: string[];
};

export type AdventureChoice = {
  label: string;
  next: string;
  difficulty?: AdventureDifficulty;
};

export type AdventureSceneCondition =
  | { kind: "storyFlag"; flag: string; equals?: boolean }
  | { kind: "visitedScene"; sceneId: string; equals?: boolean }
  | { kind: "completedChallenge"; challengeId: string; equals?: boolean }
  | { kind: "difficulty"; value: AdventureDifficulty | null; equals?: boolean }
  | { kind: "chapterComplete"; equals?: boolean };

export type AdventureSceneHotspotAction =
  | { type: "gotoScene"; sceneId: string }
  | { type: "dialogue"; dialogueId: string }
  | { type: "inspect"; title: string; description: string }
  | { type: "startChallenge"; challengeId: string }
  | { type: "startEncounter"; encounterId: string };

export type AdventureSceneHotspot = {
  id: string;
  label: string;
  shortLabel?: string;
  icon?: string;
  /** Percent coordinates inside the displayed artwork, not the browser viewport. */
  x: number;
  y: number;
  width: number;
  height: number;
  action: AdventureSceneHotspotAction;
  visibleWhen?: AdventureSceneCondition[];
  disabledWhen?: AdventureSceneCondition[];
  disabledReason?: string;
  importance?: "primary" | "secondary";
};

export type AdventureSceneRuntimeState = Pick<
  AdventureProgress,
  "chapterComplete" | "completedChallengeIds" | "difficulty" | "storyFlags" | "visitedSceneIds"
>;

export type AdventureScene = {
  id: string;
  title?: string;
  background: "road" | "inn" | "house" | "square" | "castle";
  speaker: "Narrator" | "Lem" | "Marge" | "Rookus" | "Castler" | "Stale Nate" | "Kingpin" | "Pip";
  portrait: "narrator" | "lem" | "marge" | "rookus" | "castler" | "nate" | "kingpin" | "pip";
  text: string;
  /** Public-path artwork. Scene artwork should normally be authored at 16:9. */
  backgroundImage?: string;
  backgroundAlt?: string;
  /** Image-led scenes may hide the generic portrait/avatar chips over the artwork. */
  hideArtworkOverlays?: boolean;
  hotspots?: AdventureSceneHotspot[];
  /** Facts recorded by the existing local progress controller on scene entry. */
  setsFlags?: string[];
  /** A brief, non-interactive scene-entry celebration layered over the artwork. */
  restoration?: { title: string; durationMs: number };
  next?: string;
  choices?: AdventureChoice[];
  /** A storybeat that introduces a piece immediately before its learning set. */
  pieceLesson?: AdventureLessonPiece;
  challengeId?: string;
  isBossSetup?: boolean;
  isEnding?: boolean;
};

export type AdventureDebugSceneGroup = {
  label: string;
  sceneIds: string[];
};

export type KnowledgeEntry = {
  id: string;
  title: string;
  icon: string;
  summary: string;
  detail: string;
  practiceChallengeId?: string;
};
