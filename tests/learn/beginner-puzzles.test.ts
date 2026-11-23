import { describe, expect, it } from "vitest";
import { Chess, type Square } from "chess.js";
import { learnPuzzles, learnTopics, puzzlesForTopic, readLearnProgress } from "@/lib/learn/catalog";
import { acceptedLearnMoves, kingSquare, learnExplanation, learnFollowUp, learnPrompt, playUci } from "@/lib/learn/rules";

describe("beginner Learn curriculum", () => {
  it("contains 30 distinct positions for each requested topic in order", () => {
    expect(learnTopics.map(t => t.name)).toEqual(["Mate in 1", "Hanging piece", "Defensive move", "Forks", "Pins", "Skewers"]);
    expect(learnPuzzles).toHaveLength(180);
    expect(new Set(learnPuzzles.map(p => p.id)).size).toBe(180);
    expect(new Set(learnPuzzles.map(p => p.fen)).size).toBe(180);
    for (const topic of learnTopics) expect(puzzlesForTopic(topic.id)).toHaveLength(30);
  });
  for (const topic of learnTopics) it(`${topic.name}: all positions, accepted answers and explanations are valid`, () => {
    for (const puzzle of puzzlesForTopic(topic.id)) {
      const game = new Chess(puzzle.fen), pieces = game.board().flat().filter(Boolean);
      expect(game.turn()).toBe("w");
      expect(pieces.length).toBeLessThanOrEqual(6);
      expect(game.isAttacked(kingSquare(game, "b"), "w")).toBe(false);
      expect(game.isGameOver()).toBe(false);
      expect(puzzle.solutions.length).toBeGreaterThan(0);
      expect(puzzle.solutions).toEqual(acceptedLearnMoves(puzzle));
      expect(learnPrompt(puzzle)).not.toMatch(/undefined/);
      for (const answer of puzzle.solutions) {
        expect(answer).toHaveLength(4); // No promotions or special-rule lessons in this beginner set.
        const after = new Chess(puzzle.fen), move = playUci(after, answer);
        expect(learnExplanation(puzzle, answer)).not.toMatch(/undefined/);
        if (topic.id === "mate-in-one") expect(after.isCheckmate()).toBe(true);
        if (topic.id === "hanging-piece") {
          expect(move.captured).toBeTruthy();
          expect(game.attackers(move.to, "b")).toHaveLength(0);
          expect(after.attackers(move.to, "b")).toHaveLength(0);
        }
        if (topic.id === "defensive-move") {
          // Check the white king, rather than isCheck(), which now tests Black.
          expect(after.isAttacked(kingSquare(after, "w"), "b")).toBe(false);
          if (puzzle.kind === "block") expect(after.attackers(move.to, "w")).toContain(kingSquare(after, "w"));
          else expect(after.attackers(move.to, "b")).toHaveLength(0);
        }
        if (topic.id === "pins") {
          expect(after.isCheck()).toBe(false);
          expect(after.moves({ verbose: true }).filter(m => m.from === puzzle.target)).toHaveLength(0);
          // With the king removed, the pinned piece has moves: it is the pin,
          // not an intrinsically immobile piece, that prevents those moves.
          const unpinned = new Chess(after.fen());
          unpinned.remove(kingSquare(unpinned, "b"));
          expect(unpinned.moves({ verbose: true }).some(m => m.from === puzzle.target)).toBe(true);
        }
        if (topic.id === "forks" || topic.id === "skewers") {
          expect(after.isCheck()).toBe(true);
          const replies = after.moves({ verbose: true });
          expect(replies.length).toBeGreaterThan(0);
          for (const reply of replies) {
            const next = new Chess(reply.after);
            const capture = next.move({ from: move.to, to: puzzle.target! });
            expect(capture.captured).toBe(game.get(puzzle.target as Square)!.type);
            const values: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
            if (next.isAttacked(capture.to, "b")) expect(values[capture.captured!]).toBeGreaterThan(values[capture.piece]);
          }
          const demonstration = learnFollowUp(puzzle, answer);
          expect(demonstration).toHaveLength(2);
          for (const step of demonstration) after.move(step);
          expect(after.get(puzzle.target as Square)?.color).toBe("w");
        }
      }
    }
  });
  it("accepts alternate correct answers instead of forcing one arbitrary move", () => {
    for (const topic of ["mate-in-one", "defensive-move"] as const) expect(puzzlesForTopic(topic).some(p => p.solutions.length > 1)).toBe(true);
  });
  it("repairs damaged progress and keeps only known, unique solved puzzles", () => {
    expect(readLearnProgress("bad json").topic).toBeNull();
    expect(readLearnProgress(JSON.stringify({version: 1, topic: "forks", index: 99, solved: ["forks-01", "forks-01", "bad"]}))).toEqual({ version: 1, topic: "forks", index: 29, solved: ["forks-01"] });
    expect(readLearnProgress(JSON.stringify({ version: 2, solved: ["forks-01"] })).solved).toEqual([]);
  });
});
