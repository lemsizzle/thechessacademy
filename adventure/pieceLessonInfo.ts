import type { AdventureLessonPiece } from "@/adventure/types";

export type PieceLessonIntro = {
  name: string;
  character: string;
  symbol: string;
  value: string;
  rule: string;
  reminder: string;
};

export const LEARN_CHALLENGE_PIECES: Record<string, AdventureLessonPiece> = {
  "learn-pawn": "pawn",
  "learn-rook": "rook",
  "learn-bishop": "bishop",
  "learn-queen": "queen",
  "learn-king": "king",
  "learn-knight": "knight"
};

export const PIECE_LESSON_INTROS: Record<AdventureLessonPiece, PieceLessonIntro> = {
  pawn: {
    name: "Pawn",
    character: "Pip",
    symbol: "♙",
    value: "1 point",
    rule: "Moves straight forward one square. On Pip's first move, he may move two clear squares.",
    reminder: "Pip captures one square diagonally forward — never straight ahead. Reach the far rank to choose a promotion."
  },
  rook: {
    name: "Rook",
    character: "Roger & Ricky",
    symbol: "♖",
    value: "5 points",
    rule: "Moves any number of clear squares straight up, down, left, or right.",
    reminder: "A rook cannot bend during one move. Clear lines make Roger and Ricky very happy."
  },
  bishop: {
    name: "Bishop",
    character: "Kate & Hanna",
    symbol: "♗",
    value: "3 points",
    rule: "Moves any number of clear squares diagonally.",
    reminder: "A bishop stays on the same square color all game. Two bishops work together to cover both colors."
  },
  queen: {
    name: "Queen",
    character: "Marilou",
    symbol: "♕",
    value: "9 points",
    rule: "Moves any number of clear squares straight or diagonally.",
    reminder: "Marilou combines a rook's straight lines with a bishop's diagonals. Powerful is not the same as invincible."
  },
  king: {
    name: "King",
    character: "Luis",
    symbol: "♔",
    value: "Priceless",
    rule: "Moves one square in any direction.",
    reminder: "Luis may never move into danger. If he is checkmated, the game is over — so protect him."
  },
  knight: {
    name: "Knight",
    character: "Kevin & Kai",
    symbol: "♘",
    value: "3 points",
    rule: "Moves in an L: two squares one way, then one square sideways.",
    reminder: "Knights jump over pieces. Kevin and Kai are the only pieces who do not need a clear path."
  }
};
