export type PuzzleTrainingTheme = "Fork" | "Pin" | "Skewer" | "Discovered Attack" | "Mate in 1";

export type PuzzleTrainingMove = {
  from: string;
  to: string;
  promotion?: "q" | "r" | "b" | "n";
};

export type PuzzleTrainingPosition = {
  id: string;
  theme: PuzzleTrainingTheme;
  title: string;
  instruction: string;
  fen: string;
  solution: PuzzleTrainingMove;
};

// These compact positions keep the first training release fast and focused.
// Each answer is checked as a legal move by chess.js in the training board.
export const puzzleTrainingPositions: PuzzleTrainingPosition[] = [
  {
    id: "fork-knight-rook",
    theme: "Fork",
    title: "Double Strike",
    instruction: "Find the knight move that checks the king and attacks the rook.",
    fen: "1r6/4k3/8/4N3/8/8/8/6K1 w - - 0 1",
    solution: { from: "e5", to: "c6" }
  },
  {
    id: "fork-pawn-major-pieces",
    theme: "Fork",
    title: "Pawn Power",
    instruction: "Advance the pawn to attack both major pieces.",
    fen: "6k1/2q1r3/8/3P4/8/8/8/6K1 w - - 0 1",
    solution: { from: "d5", to: "d6" }
  },
  {
    id: "pin-bishop-knight",
    theme: "Pin",
    title: "Freeze the Defender",
    instruction: "Place the bishop so the knight cannot move without exposing its king.",
    fen: "4k3/3n4/8/8/8/8/6B1/6K1 w - - 0 1",
    solution: { from: "g2", to: "c6" }
  },
  {
    id: "pin-rook-knight",
    theme: "Pin",
    title: "File Lock",
    instruction: "Move the rook onto the file that pins the knight to its king.",
    fen: "4k3/4n3/8/8/8/8/8/R5K1 w - - 0 1",
    solution: { from: "a1", to: "e1" }
  },
  {
    id: "skewer-bishop-queen",
    theme: "Skewer",
    title: "Royal X-Ray",
    instruction: "Check the king so the queen behind it will be exposed.",
    fen: "4q3/3k4/8/8/B7/8/8/6K1 w - - 0 1",
    solution: { from: "a4", to: "b5" }
  },
  {
    id: "skewer-rook-queen",
    theme: "Skewer",
    title: "King First",
    instruction: "Check along the file and line up the queen behind the king.",
    fen: "4q3/4k3/8/8/8/8/8/R5K1 w - - 0 1",
    solution: { from: "a1", to: "e1" }
  },
  {
    id: "discovered-attack-queen",
    theme: "Discovered Attack",
    title: "Open the File",
    instruction: "Move the bishop away to uncover the rook's attack on the queen.",
    fen: "4q1k1/8/8/8/4B3/8/8/4R1K1 w - - 0 1",
    solution: { from: "e4", to: "c6" }
  },
  {
    id: "discovered-check-knight",
    theme: "Discovered Attack",
    title: "Hidden Check",
    instruction: "Move the knight and reveal the rook's attack on the king.",
    fen: "3k4/8/8/8/3N4/8/8/3R2K1 w - - 0 1",
    solution: { from: "d4", to: "f5" }
  },
  {
    id: "mate-one-queen",
    theme: "Mate in 1",
    title: "Queen's Finish",
    instruction: "White to move and deliver checkmate in one.",
    fen: "5rk1/5p2/8/7Q/8/3B4/8/6K1 w - - 0 1",
    solution: { from: "h5", to: "h7" }
  },
  {
    id: "mate-one-back-rank",
    theme: "Mate in 1",
    title: "Back Rank Blast",
    instruction: "White to move and deliver checkmate in one.",
    fen: "6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1",
    solution: { from: "a1", to: "a8" }
  }
];
