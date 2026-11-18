import { describe, expect, it } from "vitest";
import { Chess } from "chess.js";
import { ENDGAME_TOPICS } from "@/lib/endgames/catalog";
import { generateEndgameCandidate, winningCandidate } from "@/lib/endgames/generator";
import { endgameResult, readEndgameProgress, replayEndgame, takeBackEndgame } from "@/lib/endgames/practice";

function seeded(seed: number) {
  return () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
}

describe("procedural endgame positions", () => {
  for (const [index, topic] of ENDGAME_TOPICS.entries()) {
    it(`generates varied, legal ${topic.title} positions`, () => {
      const random = seeded(index + 13), seen = new Set<string>();
      for (let i = 0; i < 120; i++) {
        const fen = generateEndgameCandidate(topic.id, random);
        const chess = new Chess(fen);
        seen.add(fen);
        expect(chess.isGameOver()).toBe(false);
        expect(chess.isCheck()).toBe(false);
        expect(new Chess(fen.replace(/ [wb] /, chess.turn() === "w" ? " b " : " w ")).isCheck()).toBe(false);
        const pieces = chess.board().flat().filter(piece => piece !== null);
        expect(pieces.filter(piece => piece.type === "k")).toHaveLength(2);
        const player = chess.turn();
        if (topic.id === "black-queen") expect(player).toBe("b");
        if (topic.id === "bishop-pair") {
          const bishops = pieces.filter(piece => piece.type === "b");
          expect(bishops).toHaveLength(2);
          const parity = (s: string) => (s.charCodeAt(0) + Number(s[1])) % 2;
          expect(parity(bishops[0].square)).not.toBe(parity(bishops[1].square));
        }
        expect(chess.moves().length).toBeGreaterThanOrEqual(3);
      }
      expect(seen.size).toBeGreaterThan(90);
    });
  }
  it("requires a deep enough, unbounded winning engine score", () => {
    const line = { uci: "e2e4", rank: 1, depth: 16, scoreCp: 800, mate: null, pv: ["e2e4"] };
    expect(winningCandidate(line)).toBe(true);
    expect(winningCandidate({ ...line, scoreCp: 0 })).toBe(false);
    expect(winningCandidate({ ...line, depth: 3 })).toBe(false);
    expect(winningCandidate({ ...line, bound: "lower" })).toBe(false);
    expect(winningCandidate({ ...line, mate: 1 })).toBe(false);
    expect(winningCandidate({ ...line, mate: -3 })).toBe(false);
    expect(winningCandidate({ ...line, mate: 5 })).toBe(true);
  });
});

describe("playing out a win", () => {
  const fen = "7k/8/5KQ1/8/8/8/8/8 w - - 0 1";
  it("accepts different legal moves instead of a single answer", () => {
    expect(replayEndgame(fen, ["g6g5"]).turn()).toBe("b");
    expect(replayEndgame(fen, ["g6g4"]).turn()).toBe("b");
    expect(() => replayEndgame(fen, ["g6e5"])).toThrow();
  });
  it("requires actual checkmate and distinguishes stalemate", () => {
    expect(endgameResult(replayEndgame(fen, ["g6g7"]), "w")?.won).toBe(true);
    expect(endgameResult(replayEndgame(fen, ["g6f7"]), "w")?.title).toBe("Stalemate");
    expect(endgameResult(replayEndgame(fen, ["g6f7"]), "w")?.won).toBe(false);
    expect(endgameResult(new Chess(fen), "w")).toBe(null);
  });
  it("takes back a complete turn, including an unanswered player move", () => {
    const opening = new Chess().fen();
    expect(takeBackEndgame(opening, ["e2e4"])).toEqual([]);
    expect(takeBackEndgame(opening, ["e2e4", "e7e5"])).toEqual([]);
    expect(takeBackEndgame(opening, ["e2e4", "e7e5", "g1f3"])).toEqual(["e2e4", "e7e5"]);
  });
  it("replays promotion choices and keeps repetition history", () => {
    const promotion = "7k/4P3/4K3/8/8/8/8/8 w - - 0 1";
    expect(replayEndgame(promotion, ["e7e8r"]).get("e8")?.type).toBe("r");
    const cycle = ["g1f3", "g8f6", "f3g1", "f6g8"];
    expect(endgameResult(replayEndgame(new Chess().fen(), [...cycle, ...cycle]), "w")?.title).toBe("Repeated position");
  });
  it("restores the generated FEN and full game, discarding malformed attempts", () => {
    const attempt = { fen, moves: ["g6g7"], assisted: true, completed: true };
    const saved = readEndgameProgress(JSON.stringify({ selected: "queen-mate", attempts: { "queen-mate": attempt, "rook-mate": { fen: "bad", moves: [] } } }));
    expect(saved.attempts["queen-mate"]).toEqual(attempt);
    expect(saved.attempts["rook-mate"]).toBeUndefined();
    expect(readEndgameProgress("{bad")).toEqual({ selected: null, attempts: {} });
  });
});
