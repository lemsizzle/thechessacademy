import { Chess } from "chess.js";
import { NAG_VALUES, type AnalysisNag, type AnalysisNode, type AnalysisShape, type AnalysisTree, type CompletedGameMove, type GuidedExercise } from "@/chess/analysis/types";

const SQUARE = /^[a-h][1-8]$/;
const UCI = /^([a-h][1-8])([a-h][1-8])([qrbn])?$/;

function nodeId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `node-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function createEmptyAnalysisTree(initialFen = new Chess().fen()): AnalysisTree {
  const chess = new Chess(initialFen);
  const rootId = nodeId();
  return {
    schemaVersion: 1,
    rootId,
    nodes: {
      [rootId]: {
        id: rootId, parentId: null, childrenIds: [], mainChildId: null, ply: 0,
        fen: chess.fen(), san: null, uci: null, origin: "original", comment: "", nags: [], shapes: [], referenceEvaluation: null
      }
    }
  };
}

export function createAnalysisTree(initialFen: string, moves: CompletedGameMove[]): AnalysisTree {
  let tree = createEmptyAnalysisTree(initialFen);
  let parentId = tree.rootId;
  for (const move of moves) {
    const result = addAnalysisMove(tree, parentId, move.from, move.to, move.promotion, "original");
    tree = result.tree;
    parentId = result.nodeId;
  }
  return tree;
}

export function addAnalysisMove(
  tree: AnalysisTree,
  parentId: string,
  from: string,
  to: string,
  promotion?: "q" | "r" | "b" | "n",
  origin: AnalysisNode["origin"] = "analysis"
) {
  const parent = tree.nodes[parentId];
  if (!parent) throw new Error("Analysis position was not found.");
  const uci = `${from}${to}${promotion ?? ""}`;
  const existing = parent.childrenIds.map((id) => tree.nodes[id]).find((node) => node.uci === uci);
  if (existing) return { tree, nodeId: existing.id, created: false };

  const chess = new Chess(parent.fen);
  let move;
  try {
    move = chess.move({ from, to, promotion });
  } catch {
    throw new Error("That move is not legal in this position.");
  }
  if (!move) throw new Error("That move is not legal in this position.");

  const id = nodeId();
  const node: AnalysisNode = {
    id, parentId, childrenIds: [], mainChildId: null, ply: parent.ply + 1,
    fen: chess.fen(), san: move.san, uci, origin, comment: "", nags: [], shapes: [], referenceEvaluation: null
  };
  const nextParent = {
    ...parent,
    childrenIds: [...parent.childrenIds, id],
    mainChildId: parent.mainChildId ?? id
  };
  return {
    tree: { ...tree, nodes: { ...tree.nodes, [parentId]: nextParent, [id]: node } },
    nodeId: id,
    created: true
  };
}

export function previousNodeId(tree: AnalysisTree, nodeIdValue: string) {
  return tree.nodes[nodeIdValue]?.parentId ?? nodeIdValue;
}

export function nextNodeId(tree: AnalysisTree, nodeIdValue: string) {
  const node = tree.nodes[nodeIdValue];
  return node?.mainChildId ?? node?.childrenIds[0] ?? nodeIdValue;
}

export function firstNodeId(tree: AnalysisTree) { return tree.rootId; }

export function lastMainlineNodeId(tree: AnalysisTree) {
  let id = tree.rootId;
  const seen = new Set<string>();
  while (!seen.has(id)) {
    seen.add(id);
    const next = nextNodeId(tree, id);
    if (next === id) break;
    id = next;
  }
  return id;
}

export function promoteVariation(tree: AnalysisTree, parentId: string, childId: string) {
  const parent = tree.nodes[parentId];
  if (!parent?.childrenIds.includes(childId)) throw new Error("Variation was not found.");
  return {
    ...tree,
    nodes: {
      ...tree.nodes,
      [parentId]: { ...parent, mainChildId: childId, childrenIds: [childId, ...parent.childrenIds.filter((id) => id !== childId)] }
    }
  };
}

function collectSubtree(tree: AnalysisTree, id: string, ids: Set<string>) {
  if (ids.has(id)) return;
  ids.add(id);
  for (const childId of tree.nodes[id]?.childrenIds ?? []) collectSubtree(tree, childId, ids);
}

export function deleteVariation(tree: AnalysisTree, nodeIdValue: string) {
  const node = tree.nodes[nodeIdValue];
  if (!node?.parentId) throw new Error("The starting position cannot be deleted.");
  if (node.origin === "original") throw new Error("Original game moves are immutable.");
  const parent = tree.nodes[node.parentId];
  const removed = new Set<string>();
  collectSubtree(tree, nodeIdValue, removed);
  const nodes = Object.fromEntries(Object.entries(tree.nodes).filter(([id]) => !removed.has(id)));
  const childrenIds = parent.childrenIds.filter((id) => id !== nodeIdValue);
  nodes[parent.id] = { ...parent, childrenIds, mainChildId: parent.mainChildId === nodeIdValue ? childrenIds[0] ?? null : parent.mainChildId };
  return { ...tree, nodes };
}

export function updateNodeAnnotations(tree: AnalysisTree, nodeIdValue: string, patch: Partial<Pick<AnalysisNode, "comment" | "nags" | "shapes" | "referenceEvaluation">>) {
  const node = tree.nodes[nodeIdValue];
  if (!node) throw new Error("Analysis position was not found.");
  return { ...tree, nodes: { ...tree.nodes, [nodeIdValue]: { ...node, ...patch } } };
}

export function updateNodeGuidedExercise(tree: AnalysisTree, nodeIdValue: string, exercise: GuidedExercise | null) {
  const node = tree.nodes[nodeIdValue];
  if (!node) throw new Error("Analysis position was not found.");
  return { ...tree, nodes: { ...tree.nodes, [nodeIdValue]: { ...node, guidedExercise: exercise } } };
}

export function evaluateGuidedMove(fen: string, exercise: GuidedExercise, from: string, to: string, promotion?: "q" | "r" | "b" | "n") {
  const chess = new Chess(fen);
  const move = chess.move({ from, to, promotion });
  if (!move) throw new Error("That move is not legal in this position.");
  const uci = `${from}${to}${promotion ?? ""}`;
  return { correct: exercise.expectedMovesUci.includes(uci), uci, san: move.san, fen: chess.fen() };
}

export function toggleNag(nags: AnalysisNag[], nag: AnalysisNag) {
  return nags.includes(nag) ? nags.filter((value) => value !== nag) : [...nags, nag];
}

export function validateAnalysisTree(input: unknown): AnalysisTree {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Invalid analysis tree.");
  const tree = input as AnalysisTree;
  if (tree.schemaVersion !== 1 || typeof tree.rootId !== "string" || !tree.nodes || typeof tree.nodes !== "object") throw new Error("Invalid analysis tree.");
  const entries = Object.entries(tree.nodes);
  if (!entries.length || entries.length > 5000 || !tree.nodes[tree.rootId]) throw new Error("Invalid analysis tree size.");
  for (const [id, node] of entries) {
    if (node.id !== id || !Array.isArray(node.childrenIds) || node.childrenIds.length > 100) throw new Error("Invalid analysis node.");
    new Chess(node.fen);
    if (typeof node.comment !== "string" || node.comment.length > 5000 || !Array.isArray(node.nags) || node.nags.some((nag) => !NAG_VALUES.includes(nag)) || !Array.isArray(node.shapes) || node.shapes.length > 200) throw new Error("Invalid analysis annotations.");
    if (node.parentId === null) {
      if (id !== tree.rootId || node.ply !== 0) throw new Error("Invalid analysis root.");
    } else {
      const parent = tree.nodes[node.parentId];
      if (!parent?.childrenIds.includes(id) || node.ply !== parent.ply + 1 || !node.uci || !UCI.test(node.uci)) throw new Error("Invalid analysis branch.");
      const chess = new Chess(parent.fen);
      const match = UCI.exec(node.uci);
      const move = match ? chess.move({ from: match[1], to: match[2], promotion: match[3] }) : null;
      if (!move || chess.fen() !== node.fen || move.san !== node.san) throw new Error("Analysis branch contains an illegal move.");
    }
    if (node.mainChildId && !node.childrenIds.includes(node.mainChildId)) throw new Error("Invalid main variation.");
    const reference = node.referenceEvaluation;
    if (reference !== undefined && reference !== null) {
      if (typeof reference !== "object" || reference.engine !== "stockfish-18-lite") throw new Error("Invalid reference evaluation.");
      const scoreValid = reference.scoreWhiteCp === null || (Number.isInteger(reference.scoreWhiteCp) && Math.abs(reference.scoreWhiteCp) <= 100000);
      const mateValid = reference.mateWhite === null || (Number.isInteger(reference.mateWhite) && Math.abs(reference.mateWhite) <= 1000);
      if (!scoreValid || !mateValid || (reference.scoreWhiteCp === null && reference.mateWhite === null)) throw new Error("Invalid reference evaluation score.");
      if (!Number.isInteger(reference.depth) || reference.depth < 1 || reference.depth > 100) throw new Error("Invalid reference evaluation depth.");
      if (!Array.isArray(reference.pvUci) || !reference.pvUci.length || reference.pvUci.length > 32 || reference.pvUci.some((move) => typeof move !== "string" || !UCI.test(move))) throw new Error("Invalid reference evaluation line.");
      if (typeof reference.pvSan !== "string" || reference.pvSan.length > 2000 || !reference.pvSan.trim()) throw new Error("Invalid reference evaluation notation.");
      if (typeof reference.savedAt !== "string" || !reference.savedAt || Number.isNaN(Date.parse(reference.savedAt))) throw new Error("Invalid reference evaluation timestamp.");
    }
    const exercise = node.guidedExercise;
    if (exercise !== undefined && exercise !== null) {
      if (typeof exercise !== "object" || typeof exercise.prompt !== "string" || !exercise.prompt.trim() || exercise.prompt.length > 500) throw new Error("Invalid guided exercise prompt.");
      if (typeof exercise.successMessage !== "string" || exercise.successMessage.length > 1000) throw new Error("Invalid guided exercise feedback.");
      if (!Array.isArray(exercise.expectedMovesUci) || exercise.expectedMovesUci.length < 1 || exercise.expectedMovesUci.length > 8) throw new Error("Invalid guided exercise moves.");
      const expectedMoves = new Set(exercise.expectedMovesUci);
      if (expectedMoves.size !== exercise.expectedMovesUci.length || exercise.expectedMovesUci.some((move) => typeof move !== "string" || !UCI.test(move))) throw new Error("Invalid guided exercise moves.");
      const legalMoves = new Set(new Chess(node.fen).moves({ verbose: true }).map((move) => `${move.from}${move.to}${move.promotion ?? ""}`));
      if (exercise.expectedMovesUci.some((move) => !legalMoves.has(move))) throw new Error("Guided exercise contains an illegal expected move.");
    }
    for (const shape of node.shapes) {
      if (shape.type === "arrow" && (!SQUARE.test(shape.from) || !SQUARE.test(shape.to))) throw new Error("Invalid analysis arrow.");
      if (shape.type === "circle" && !SQUARE.test(shape.square)) throw new Error("Invalid analysis circle.");
      if (!["primary", "secondary", "warning", "danger"].includes(shape.style)) throw new Error("Invalid analysis shape style.");
    }
  }
  const reachable = new Set<string>();
  const visit = (id: string) => {
    if (reachable.has(id)) return;
    reachable.add(id);
    for (const childId of tree.nodes[id]?.childrenIds ?? []) visit(childId);
  };
  visit(tree.rootId);
  if (reachable.size !== entries.length) throw new Error("Analysis tree contains orphaned positions.");
  return tree;
}

export function mainlineIds(tree: AnalysisTree) {
  const ids = [tree.rootId];
  while (true) {
    const next = nextNodeId(tree, ids.at(-1)!);
    if (next === ids.at(-1) || ids.includes(next)) return ids;
    ids.push(next);
  }
}

export type MainlineMoveRow = {
  moveNumber: number;
  whiteNodeId: string | null;
  blackNodeId: string | null;
};

export function mainlineMoveRows(tree: AnalysisTree) {
  const rows: MainlineMoveRow[] = [];
  for (const id of mainlineIds(tree).slice(1)) {
    const node = tree.nodes[id];
    if (!node) continue;
    const moveNumber = Math.ceil(node.ply / 2);
    let row = rows.at(-1);
    if (!row || row.moveNumber !== moveNumber) {
      row = { moveNumber, whiteNodeId: null, blackNodeId: null };
      rows.push(row);
    }
    if (node.ply % 2) row.whiteNodeId = id;
    else row.blackNodeId = id;
  }
  return rows;
}
