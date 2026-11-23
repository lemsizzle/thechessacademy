import data from "./puzzles.json";
import type { LearnPuzzle, LearnTopicId } from "./types";

export const learnTopics: { id: LearnTopicId; name: string; icon: string; lesson: string }[] = [
  { id: "mate-in-one", name: "Mate in 1", icon: "♔", lesson: "Checkmate means the king is attacked and cannot escape, block the check, or capture the attacker. Find one move that ends the game." },
  { id: "hanging-piece", name: "Hanging piece", icon: "♜", lesson: "A hanging piece is not protected. Find a capture you can make without losing your capturing piece in return." },
  { id: "defensive-move", name: "Defensive move", icon: "♖", lesson: "Look at your opponent’s threat first. Save an attacked piece, block a check with a protected piece, or capture the checking piece." },
  { id: "forks", name: "Forks", icon: "♞", lesson: "A fork attacks two pieces at once. Here, check the king and attack another piece. Black must answer the check before saving the other piece." },
  { id: "pins", name: "Pins", icon: "♗", lesson: "An absolute pin traps a piece in front of its king. In these positions, the pinned piece cannot move because that would expose the king to check." },
  { id: "skewers", name: "Skewers", icon: "♛", lesson: "A skewer attacks a valuable piece in front of another piece. Here, check the king so it must move out of the way and reveal a piece behind it." }
];
export const learnPuzzles = data as LearnPuzzle[];
export const puzzlesForTopic = (topic: LearnTopicId) => learnPuzzles.filter(puzzle => puzzle.topic === topic);

export type LearnProgress = { version: 1; topic: LearnTopicId | null; index: number; solved: string[] };
export const emptyLearnProgress = (): LearnProgress => ({ version: 1, topic: null, index: 0, solved: [] });
const ids = new Set(learnPuzzles.map(puzzle => puzzle.id));
export function readLearnProgress(value: string | null): LearnProgress {
  try {
    if (!value || value.length > 20_000) return emptyLearnProgress();
    const data = JSON.parse(value);
    if (!data || data.version !== 1) return emptyLearnProgress();
    return { version: 1, topic: learnTopics.some(topic => topic.id === data.topic) ? data.topic : null,
      index: Number.isInteger(data.index) ? Math.min(29, Math.max(0, data.index)) : 0,
      solved: Array.isArray(data.solved) ? [...new Set<string>(data.solved.filter((id: unknown) => typeof id === "string" && ids.has(id)))] : [] };
  } catch { return emptyLearnProgress(); }
}
