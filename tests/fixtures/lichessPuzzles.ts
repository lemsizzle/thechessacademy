import type { ChessPuzzleRow } from "../../lib/puzzle-training/types";

function puzzle(overrides: Partial<ChessPuzzleRow> & Pick<ChessPuzzleRow, "initial_fen" | "moves" | "themes">): ChessPuzzleRow {
  return {
    id: crypto.randomUUID(),
    lichess_puzzle_id: crypto.randomUUID().slice(0, 8),
    rating: 1200,
    rating_deviation: 75,
    popularity: 90,
    number_of_plays: 1000,
    game_url: "https://lichess.org/example#1",
    opening_tags: [],
    random_key: 0.5,
    is_active: true,
    ...overrides
  };
}

export const forkPuzzle = puzzle({
  initial_fen: "1r2k3/8/8/4N3/8/8/8/6K1 b - - 0 1",
  moves: ["e8e7", "e5c6"],
  themes: ["fork", "short"]
});

export const pinPuzzle = puzzle({
  initial_fen: "4k3/p2n4/8/8/8/8/6B1/6K1 b - - 0 1",
  moves: ["a7a6", "g2c6"],
  themes: ["pin"]
});

export const skewerPuzzle = puzzle({
  initial_fen: "4k3/p2q4/8/8/B7/8/8/6K1 b - - 0 1",
  moves: ["a7a6", "a4d7"],
  themes: ["skewer"]
});

export const matePuzzle = puzzle({
  initial_fen: "6k1/5r2/8/7Q/8/3B4/8/6K1 b - - 0 1",
  moves: ["f7f8", "h5h7"],
  themes: ["mateIn1"]
});

export const alternateMatePuzzle = puzzle({
  initial_fen: "7k/p7/6K1/5Q2/8/8/8/8 b - - 0 1",
  moves: ["a7a6", "f5c8"],
  themes: ["mateIn1"]
});

export const promotionPuzzle = puzzle({
  initial_fen: "1k6/4P3/8/8/8/8/8/6K1 b - - 0 1",
  moves: ["b8a8", "e7e8n"],
  themes: ["fork", "underPromotion"]
});

export const multiMovePuzzle = puzzle({
  initial_fen: "q3k1nr/1pp1nQpp/3p4/1P2p3/4P3/B1PP1b2/B5PP/5K2 b k - 0 17",
  moves: ["e8d7", "a2e6", "d7d8", "f7f8"],
  themes: ["mateIn2"]
});
