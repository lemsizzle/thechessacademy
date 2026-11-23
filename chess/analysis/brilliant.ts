import { Chess, type Square } from "chess.js";
import type { AnalysisTree } from "./types";
import { evaluationAsCentipawns, mainlineNodeIds, type PositionEvaluation } from "./mistakes";
import type { StockfishCandidate } from "@/chess/types";

const values = { p: 100, n: 300, b: 300, r: 500, q: 900, k: 0 };
const names = { p: "pawn", n: "knight", b: "bishop", r: "rook", q: "queen", k: "king" };
export type BrilliantMove = { nodeId: string; ply: number; san: string; moveLabel: string; explanation: string };
type Analyze = (fen: string, ms: number) => Promise<StockfishCandidate[]>;

// Legal exchanges only: pinned pieces and illegal king captures cannot accept
// a sacrifice. Allow either side to decline further exchanges. Bound the search.
function exchangeGain(board: Chess, square: Square, depth = 0): number {
  if (depth >= 8) throw new Error("Exchange too long to classify confidently");
  let best = 0;
  for (const move of board.moves({ verbose: true }).filter(m => m.to === square && m.captured)) {
    board.move(move);
    const gain = values[move.captured!] + (move.promotion ? values[move.promotion] - 100 : 0) - exchangeGain(board, square, depth + 1);
    board.undo();
    best = Math.max(best, gain);
  }
  return best;
}

/** A newly offered non-pawn piece, costing at least an exchange after recaptures. */
export function offeredSacrifice(fen: string, uci: string) {
  try {
    const before = new Chess(fen);
    if (before.moves().length < 2) return null;
    const after = new Chess(fen);
    const played = after.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
    if (played.promotion || after.isGameOver()) return null;
    const credit = played.captured ? values[played.captured] : 0;
    // Switch only the side to move to test whether this piece was already lost.
    const fields = fen.split(" "); fields[1] = after.turn(); fields[3] = "-";
    const previousThreats = new Chess(fields.join(" "));
    for (const capture of after.moves({ verbose: true })) {
      if (!capture.captured || values[capture.captured] < 300) continue;
      const loss = exchangeGain(after, capture.to) - credit;
      if (loss < 200) continue;
      const oldSquare = capture.to === played.to ? played.from : capture.to;
      if (exchangeGain(previousThreats, oldSquare) >= 200) continue;
      return { piece: names[capture.captured], square: capture.to, captureUci: capture.from + capture.to + (capture.promotion ?? ""), afterFen: after.fen() };
    }
  } catch { /* Invalid or incomplete source: no classification. */ }
  return null;
}

function exact(lines: StockfishCandidate[]) {
  return lines.filter(line => !line.bound && line.depth >= 12 && (line.mate !== null || Number.isFinite(line.scoreCp))).sort((a, b) => a.rank - b.rank);
}
function score(line: StockfishCandidate, direction = 1) {
  return line.mate !== null ? Math.sign(line.mate) * direction * 100_000 : (line.scoreCp ?? -100_000) * direction;
}

/** Conservative approximation of published good-sacrifice criteria, not Chess.com's private formula. */
export function isSoundBrilliance(beforeLines: StockfishCandidate[], afterLines: StockfishCandidate[], uci: string) {
  const before = exact(beforeLines), after = exact(afterLines);
  const best = before.find(line => line.rank === 1), reply = after.find(line => line.rank === 1);
  if (!best || !reply) return false;
  const played = before.find(line => line.uci === uci);
  if (!played || score(best) - score(played) > 35 || score(reply, -1) < -50) return false;
  if (score(best) - score(reply, -1) > 50) return false;
  // Need evidence of alternatives; don't reward forced moves or easy wins.
  const alternatives = before.filter(line => line.uci !== uci);
  return alternatives.length > 0 && !alternatives.some(line => score(line) >= 300);
}

export async function findBrilliantMoves(tree: AnalysisTree, color: "white" | "black", analyze: Analyze, cancelled: () => boolean, onProgress?: (current: number, total: number) => void, initialEvaluations?: PositionEvaluation[]) {
  const ids = mainlineNodeIds(tree);
  const screened = initialEvaluations ? new Map(initialEvaluations.map(item => [item.nodeId, item])) : null;
  const candidates = ids.slice(1).flatMap(id => {
    const node = tree.nodes[id], parent = node.parentId ? tree.nodes[node.parentId] : null;
    if (!parent || node.origin !== "original" || !node.uci || !node.san || parent.fen.split(" ")[1] !== (color === "white" ? "w" : "b")) return [];
    if (screened) {
      const before = screened.get(parent.id), after = screened.get(node.id);
      const cp = after ? evaluationAsCentipawns(after) : null;
      if (!before || cp === null || cp * (color === "white" ? 1 : -1) < -50 || !(before.acceptedMovesUci ?? [before.bestMoveUci]).includes(node.uci)) return [];
    }
    const offer = offeredSacrifice(parent.fen, node.uci);
    return offer ? [{ node, parent, offer }] : [];
  });
  const result: BrilliantMove[] = [];
  for (const [index, { node, parent, offer }] of candidates.entries()) {
    if (cancelled()) return [];
    onProgress?.(index, candidates.length);
    const before = await analyze(parent.fen, 900);
    if (cancelled()) return [];
    const after = await analyze(node.fen, 900);
    if (cancelled()) return [];
    if (!isSoundBrilliance(before, after, node.uci!)) continue;
    // Explicitly verify accepting the sacrifice too, even when the main reply declines it.
    const accepted = new Chess(offer.afterFen);
    const capture = accepted.move({ from: offer.captureUci.slice(0, 2), to: offer.captureUci.slice(2, 4), promotion: offer.captureUci[4] });
    const continuation = exact(await analyze(accepted.fen(), 900)).find(line => line.rank === 1);
    if (cancelled()) return [];
    if (!continuation || score(continuation) < -50) continue;
    let followUp: string;
    try { followUp = accepted.move({ from: continuation.uci.slice(0, 2), to: continuation.uci.slice(2, 4), promotion: continuation.uci[4] }).san; }
    catch { continue; }
    const idea = followUp.includes("#") ? `${followUp} is checkmate` : continuation.mate !== null && continuation.mate > 0 ? `${followUp} starts a forced checkmate` : `${followUp} keeps your position sound with accurate play`;
    result.push({ nodeId: node.id, ply: node.ply, san: node.san!, moveLabel: `${parent.fen.split(" ")[5]}${color === "white" ? "." : "…"} ${node.san}`, explanation: `${node.san} offers the ${offer.piece} on ${offer.square}. If your opponent accepts with ${capture.san}, ${idea}. This is one of the strongest moves, with no easy winning alternative found.` });
  }
  return result;
}
