import type { Resource } from "@/lib/types";

export const resources: Resource[] = [
  {
    id: "lichess-puzzles",
    title: "Lichess Puzzle Trainer",
    description: "Free chess tactics practice for building calculation habits between classes.",
    url: "https://lichess.org/training",
    category: "Puzzles",
    status: "active",
    featured: true,
    createdAt: "2026-06-20",
    updatedAt: "2026-06-20"
  },
  {
    id: "chesskid",
    title: "ChessKid",
    description: "Kid-friendly chess lessons, puzzles, and practice games.",
    url: "https://www.chesskid.com/",
    category: "Practice",
    status: "active",
    featured: true,
    createdAt: "2026-06-20",
    updatedAt: "2026-06-20"
  },
  {
    id: "opening-principles-sheet",
    title: "Opening Principles Review",
    description: "Class reminder: control the center, develop pieces, castle, and avoid early queen adventures.",
    url: "https://lichess.org/practice",
    category: "Openings",
    status: "active",
    featured: false,
    createdAt: "2026-06-20",
    updatedAt: "2026-06-20"
  },
  {
    id: "parent-tournament-guide",
    title: "Parent Tournament Guide",
    description: "A helpful overview for preparing young players for their first chess event.",
    url: "https://www.uschess.org/",
    category: "Parent Info",
    status: "inactive",
    featured: false,
    createdAt: "2026-06-20",
    updatedAt: "2026-06-20"
  }
];
