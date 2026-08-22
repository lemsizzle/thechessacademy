import { Chess } from "chess.js";
import { describe, expect, it } from "vitest";
import { buildMistakePuzzles, classifyCentipawnLoss, equivalentEngineMoves, evaluationAsCentipawns, explainMistake, mainlineNodeIds, type PositionEvaluation } from "@/chess/analysis/mistakes";
import type { StockfishCandidate } from "@/chess/types";
import { createAnalysisTree } from "@/chess/analysis/tree";
import type { CompletedGameMove } from "@/chess/analysis/types";

function gameLine() {
  const chess = new Chess();
  const moves: CompletedGameMove[] = [];
  for (const san of ["e4", "e5", "Nf3", "Nc6"]) {
    const move = chess.move(san);
    moves.push({
      ply: moves.length + 1,
      color: move.color === "w" ? "white" : "black",
      san: move.san,
      from: move.from,
      to: move.to,
      fenAfter: chess.fen()
    });
  }
  return createAnalysisTree(new Chess().fen(), moves);
}

function evaluation(nodeId: string, scoreWhiteCp: number, bestMoveUci: string): PositionEvaluation {
  return { nodeId, scoreWhiteCp, mateWhite: null, bestMoveUci, bestLineSan: bestMoveUci, depth: 12 };
}

describe("learn from your mistakes", () => {
  it("explains the missed idea, engine reply, and evaluation loss", () => {
    expect(explainMistake({
      playedMoveSan: "e4",
      bestMoveSan: "Bxh7+",
      replyLineSan: "Nxe4 Qe2",
      centipawnLoss: 140
    })).toBe("After e4, your opponent can win material with Nxe4. That gives your opponent a clear advantage—about the value of one pawn. Before choosing a move, look at every check. A strong check was available here.");
  });

  it("uses beginner-friendly language instead of raw engine terminology", () => {
    expect(explainMistake({
      playedMoveSan: "Qe8",
      bestMoveSan: "Qf8",
      replyLineSan: "Re1 Qf7 Re7 Kg8",
      centipawnLoss: 270
    })).toBe("After Qe8, your opponent can activate a rook with Re1. That gives your opponent a big advantage—about the value of three pawns. Try to find a move that stops Re1 while keeping your pieces safe and active.");
  });

  it("accepts near-equal engine alternatives instead of demanding one exact move", () => {
    const line = (uci: string, rank: number, scoreCp: number): StockfishCandidate => ({ uci, rank, scoreCp, mate: null, depth: 12, pv: [uci] });
    expect(equivalentEngineMoves([line("e2e4", 1, 40), line("d2d4", 2, 18), line("g1f3", 3, -5)])).toEqual(["e2e4", "d2d4"]);
  });

  it("uses familiar inaccuracy, mistake, and blunder thresholds", () => {
    expect(classifyCentipawnLoss(49)).toBeNull();
    expect(classifyCentipawnLoss(50)).toBe("inaccuracy");
    expect(classifyCentipawnLoss(100)).toBe("mistake");
    expect(classifyCentipawnLoss(200)).toBe("blunder");
  });

  it("normalizes forced mates beyond ordinary centipawn evaluations", () => {
    expect(evaluationAsCentipawns({ scoreWhiteCp: null, mateWhite: 3 })).toBe(99_700);
    expect(evaluationAsCentipawns({ scoreWhiteCp: null, mateWhite: -2 })).toBe(-99_800);
  });

  it("turns only the selected player's evaluation drops into puzzles", () => {
    const tree = gameLine();
    const [root, whiteMove, blackMove, secondWhiteMove, secondBlackMove] = mainlineNodeIds(tree);
    const evaluations = [
      evaluation(root, 20, "d2d4"),
      evaluation(whiteMove, -210, "e7e5"),
      evaluation(blackMove, -200, "g1f3"),
      evaluation(secondWhiteMove, -220, "b8c6"),
      evaluation(secondBlackMove, -210, "f1b5")
    ];

    const whitePuzzles = buildMistakePuzzles(tree, evaluations, "white");
    const blackPuzzles = buildMistakePuzzles(tree, evaluations, "black");

    expect(whitePuzzles).toHaveLength(1);
    expect(whitePuzzles[0]).toMatchObject({
      beforeNodeId: root,
      afterNodeId: whiteMove,
      playedMoveSan: "e4",
      bestMoveSan: "d4",
      centipawnLoss: 230,
      severity: "blunder",
      explanation: expect.stringContaining("keeping your pieces safe and active")
    });
    expect(blackPuzzles).toHaveLength(0);
  });

  it("does not flag a move when Stockfish's best move was played", () => {
    const tree = gameLine();
    const ids = mainlineNodeIds(tree);
    const evaluations = ids.map((id, index) => evaluation(id, index === 0 ? 200 : 0, index === 0 ? "e2e4" : "a2a3"));
    expect(buildMistakePuzzles(tree, evaluations, "white")).toEqual([]);
  });

  it("does not flag an accepted near-equal alternative", () => {
    const tree = gameLine();
    const ids = mainlineNodeIds(tree);
    const evaluations = ids.map((id, index) => ({
      ...evaluation(id, index === 0 ? 200 : 0, index === 0 ? "d2d4" : "a2a3"),
      acceptedMovesUci: index === 0 ? ["d2d4", "e2e4"] : ["a2a3"]
    }));
    expect(buildMistakePuzzles(tree, evaluations, "white")).toEqual([]);
  });

  it("excludes inaccuracies from the retry puzzles", () => {
    const tree = gameLine();
    const [root, whiteMove, ...remainingIds] = mainlineNodeIds(tree);
    const evaluations = [
      evaluation(root, 80, "d2d4"),
      evaluation(whiteMove, 0, "e7e5"),
      ...remainingIds.map((id) => evaluation(id, 0, "a2a3"))
    ];

    expect(buildMistakePuzzles(tree, evaluations, "white")).toEqual([]);
  });
});
