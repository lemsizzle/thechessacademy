import { Chess } from "chess.js";
import { describe, expect, it } from "vitest";
import { addAnalysisMove, createAnalysisTree, deleteVariation, lastMainlineNodeId, nextNodeId, previousNodeId, promoteVariation, updateNodeAnnotations, validateAnalysisTree } from "@/chess/analysis/tree";
import type { CompletedGameMove } from "@/chess/analysis/types";

function originalLine() {
  const chess = new Chess();
  const moves: CompletedGameMove[] = [];
  for (const san of ["e4", "e5", "Nf3"]) {
    const move = chess.move(san);
    moves.push({ ply: moves.length + 1, color: move.color === "w" ? "white" : "black", san: move.san, from: move.from, to: move.to, fenAfter: chess.fen() });
  }
  return moves;
}

describe("analysis move tree", () => {
  it("navigates the imported main line in both directions", () => {
    const tree = createAnalysisTree(new Chess().fen(), originalLine());
    const first = nextNodeId(tree, tree.rootId);
    const second = nextNodeId(tree, first);
    expect(tree.nodes[first].san).toBe("e4");
    expect(tree.nodes[second].san).toBe("e5");
    expect(previousNodeId(tree, second)).toBe(first);
    expect(tree.nodes[lastMainlineNodeId(tree)].san).toBe("Nf3");
    expect(tree.nodes[lastMainlineNodeId(tree)].fen).toBe(originalLine().at(-1)?.fenAfter);
  });

  it("supports nested variations without flattening either branch", () => {
    let tree = createAnalysisTree(new Chess().fen(), originalLine());
    const d4 = addAnalysisMove(tree, tree.rootId, "d2", "d4");
    const d5 = addAnalysisMove(d4.tree, d4.nodeId, "d7", "d5");
    tree = d5.tree;
    expect(tree.nodes[d4.nodeId].parentId).toBe(tree.rootId);
    expect(tree.nodes[d5.nodeId].parentId).toBe(d4.nodeId);
    expect(tree.nodes[d4.nodeId].childrenIds).toContain(d5.nodeId);
    expect(tree.nodes[tree.rootId].childrenIds).toHaveLength(2);
  });

  it("adds, promotes, annotates, serializes, and deletes a legal variation", () => {
    let tree = createAnalysisTree(new Chess().fen(), originalLine());
    const variation = addAnalysisMove(tree, tree.rootId, "d2", "d4");
    tree = promoteVariation(variation.tree, tree.rootId, variation.nodeId);
    tree = updateNodeAnnotations(tree, variation.nodeId, {
      comment: "Controls the center.", nags: ["!"],
      shapes: [{ type: "arrow", from: "d2", to: "d4", style: "primary" }, { type: "circle", square: "d5", style: "warning" }]
    });
    const roundTrip = validateAnalysisTree(JSON.parse(JSON.stringify(tree)));
    expect(nextNodeId(roundTrip, roundTrip.rootId)).toBe(variation.nodeId);
    expect(roundTrip.nodes[variation.nodeId].comment).toContain("center");
    const deleted = deleteVariation(roundTrip, variation.nodeId);
    expect(deleted.nodes[variation.nodeId]).toBeUndefined();
    expect(nextNodeId(deleted, deleted.rootId)).not.toBe(variation.nodeId);
  });

  it("never deletes an original game move", () => {
    const tree = createAnalysisTree(new Chess().fen(), originalLine());
    expect(() => deleteVariation(tree, nextNodeId(tree, tree.rootId))).toThrow("immutable");
  });

  it("rejects corrupted persisted positions", () => {
    const tree = createAnalysisTree(new Chess().fen(), originalLine());
    const child = nextNodeId(tree, tree.rootId);
    const corrupted = { ...tree, nodes: { ...tree.nodes, [child]: { ...tree.nodes[child], fen: new Chess().fen() } } };
    expect(() => validateAnalysisTree(corrupted)).toThrow("illegal move");
  });

  it("persists an explicit teacher reference evaluation on one position", () => {
    let tree = createAnalysisTree(new Chess().fen(), originalLine());
    const e4 = nextNodeId(tree, tree.rootId);
    tree = updateNodeAnnotations(tree, e4, {
      referenceEvaluation: {
        engine: "stockfish-18-lite",
        scoreWhiteCp: 34,
        mateWhite: null,
        depth: 18,
        pvUci: ["e7e5", "g1f3", "b8c6"],
        pvSan: "e5 Nf3 Nc6",
        savedAt: "2026-08-16T00:00:00.000Z"
      }
    });
    const restored = validateAnalysisTree(JSON.parse(JSON.stringify(tree)));
    expect(restored.nodes[e4].referenceEvaluation).toMatchObject({ scoreWhiteCp: 34, depth: 18, pvSan: "e5 Nf3 Nc6" });
  });

  it("rejects malformed saved engine references", () => {
    const tree = createAnalysisTree(new Chess().fen(), originalLine());
    const e4 = nextNodeId(tree, tree.rootId);
    const corrupted = {
      ...tree,
      nodes: { ...tree.nodes, [e4]: { ...tree.nodes[e4], referenceEvaluation: { engine: "unknown", scoreWhiteCp: null, mateWhite: null, depth: 0, pvUci: [], pvSan: "", savedAt: "never" } } }
    };
    expect(() => validateAnalysisTree(corrupted)).toThrow("reference evaluation");
  });
});
