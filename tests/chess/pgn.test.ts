import { describe, expect, it } from "vitest";
import { exportAnalysisTreeToPgn, parsePgnToAnalysisTree } from "@/chess/analysis/pgn";
import type { AnalysisTree } from "@/chess/analysis/types";

function project(tree: AnalysisTree, nodeId = tree.rootId): unknown {
  const node = tree.nodes[nodeId];
  return {
    san: node.san,
    comment: node.comment,
    nags: node.nags,
    mainIndex: node.mainChildId ? node.childrenIds.indexOf(node.mainChildId) : -1,
    children: node.childrenIds.map((childId) => project(tree, childId))
  };
}

describe("study PGN interoperability", () => {
  const annotatedPgn = `[Event "Academy lesson"]
[White "Student"]
[Black "Coach"]
[Result "1-0"]

1. e4! e5 {Black claims the center.} (1... c5 2. Nf3 (2. d4))
2. Nf3 Nc6 $2 3. Bb5 1-0`;

  it("imports headers, comments, NAGs, and nested variations", () => {
    const parsed = parsePgnToAnalysisTree(annotatedPgn);
    const root = parsed.tree.nodes[parsed.tree.rootId];
    const e4 = parsed.tree.nodes[root.mainChildId!];
    const e5 = parsed.tree.nodes[e4.mainChildId!];
    const c5 = parsed.tree.nodes[e4.childrenIds.find((id) => id !== e4.mainChildId)!];
    const variationNf3 = parsed.tree.nodes[c5.mainChildId!];

    expect(parsed.headers.Event).toBe("Academy lesson");
    expect(parsed.result).toBe("1-0");
    expect(e4.san).toBe("e4");
    expect(e4.nags).toEqual(["!"]);
    expect(e5.comment).toBe("Black claims the center.");
    expect(c5.san).toBe("c5");
    expect(variationNf3.childrenIds.map((id) => parsed.tree.nodes[id].san)).toEqual([]);
    expect(c5.childrenIds.map((id) => parsed.tree.nodes[id].san)).toEqual(["Nf3", "d4"]);
  });

  it("exports a tree and reconstructs the same annotated structure", () => {
    const imported = parsePgnToAnalysisTree(annotatedPgn);
    const exported = exportAnalysisTreeToPgn(imported.tree, { ...imported.headers, Result: imported.result });
    const roundTrip = parsePgnToAnalysisTree(exported);

    expect(exported).toContain("$1");
    expect(exported).toContain("{Black claims the center.}");
    expect(exported).toContain("(1... c5");
    expect(project(roundTrip.tree)).toEqual(project(imported.tree));
    expect(roundTrip.result).toBe("1-0");
  });

  it("preserves a custom starting FEN", () => {
    const fen = "8/8/8/8/8/8/4K3/7k w - - 0 1";
    const parsed = parsePgnToAnalysisTree(`[SetUp "1"]\n[FEN "${fen}"]\n\n1. Kf2 *`);
    const exported = exportAnalysisTreeToPgn(parsed.tree);
    expect(parsed.tree.nodes[parsed.tree.rootId].fen).toBe(fen);
    expect(exported).toContain(`[FEN "${fen}"]`);
  });

  it("rejects illegal movetext with a useful client-safe error", () => {
    expect(() => parsePgnToAnalysisTree("1. e5 *")).toThrow("Invalid PGN");
  });
});
