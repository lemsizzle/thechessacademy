import { Chess } from "chess.js";
import type { AnalysisTree } from "@/chess/analysis/types";
import type { StockfishCandidate } from "@/chess/types";

export const MISTAKE_EQUIVALENT_MOVE_MARGIN_CP = 35;

export type MistakeSeverity = "inaccuracy" | "mistake" | "blunder";

export type PositionEvaluation = {
  nodeId: string;
  scoreWhiteCp: number | null;
  mateWhite: number | null;
  bestMoveUci: string;
  acceptedMovesUci?: string[];
  bestLineSan: string;
  depth: number;
};

export type MistakePuzzle = {
  id: string;
  beforeNodeId: string;
  afterNodeId: string;
  ply: number;
  moveNumber: number;
  color: "white" | "black";
  fen: string;
  playedMoveSan: string;
  playedMoveUci: string;
  bestMoveSan: string;
  bestMoveUci: string;
  acceptedMovesUci: string[];
  bestLineSan: string;
  explanation: string;
  centipawnLoss: number;
  severity: MistakeSeverity;
};

export function mainlineNodeIds(tree: AnalysisTree) {
  const ids = [tree.rootId];
  const seen = new Set(ids);
  let node = tree.nodes[tree.rootId];
  while (node?.mainChildId && !seen.has(node.mainChildId)) {
    ids.push(node.mainChildId);
    seen.add(node.mainChildId);
    node = tree.nodes[node.mainChildId];
  }
  return ids;
}

export function evaluationAsCentipawns(evaluation: Pick<PositionEvaluation, "scoreWhiteCp" | "mateWhite">) {
  if (evaluation.mateWhite !== null) {
    const distance = Math.min(999, Math.abs(evaluation.mateWhite));
    return Math.sign(evaluation.mateWhite) * (100_000 - distance * 100);
  }
  return evaluation.scoreWhiteCp;
}

export function classifyCentipawnLoss(loss: number): MistakeSeverity | null {
  if (loss >= 200) return "blunder";
  if (loss >= 100) return "mistake";
  if (loss >= 50) return "inaccuracy";
  return null;
}

export function equivalentEngineMoves(lines: StockfishCandidate[], marginCp = MISTAKE_EQUIVALENT_MOVE_MARGIN_CP) {
  const exact = lines.filter((line) => !line.bound).sort((left, right) => left.rank - right.rank);
  const best = exact[0];
  if (!best) return [];
  const accepted = exact.filter((line) => {
    if (line.uci === best.uci) return true;
    if (best.mate !== null) return line.mate !== null && Math.sign(line.mate) === Math.sign(best.mate);
    if (line.mate !== null) return line.mate > 0;
    return best.scoreCp !== null && line.scoreCp !== null && best.scoreCp - line.scoreCp <= marginCp;
  });
  return [...new Set(accepted.map((line) => line.uci))];
}

function sanForUci(fen: string, uci: string) {
  const match = /^([a-h][1-8])([a-h][1-8])([qrbn])?$/.exec(uci);
  if (!match) return uci;
  try {
    return new Chess(fen).move({ from: match[1], to: match[2], promotion: match[3] })?.san ?? uci;
  } catch {
    return uci;
  }
}

export function explainMistake({
  playedMoveSan,
  bestMoveSan,
  replyLineSan,
  centipawnLoss
}: {
  playedMoveSan: string;
  bestMoveSan: string;
  replyLineSan: string;
  centipawnLoss: number;
}) {
  const swing = centipawnLoss >= 10_000
    ? "causes a decisive swing in the position"
    : `gives up about ${(centipawnLoss / 100).toFixed(1)} pawns of evaluation`;
  const replyPreview = replyLineSan.trim().split(/\s+/).slice(0, 4).join(" ");
  const consequence = replyPreview ? ` It allows the engine continuation ${replyPreview}.` : "";
  const missedIdea = bestMoveSan.includes("#")
    ? "A forced checkmate was available instead."
    : bestMoveSan.includes("+")
      ? "A stronger forcing check was available."
      : bestMoveSan.includes("x")
        ? "A stronger capture was available."
        : /^O-O/.test(bestMoveSan)
          ? "Securing the king was more urgent."
          : "A more accurate move was needed to keep the position stable.";
  return `${playedMoveSan} ${swing}.${consequence} ${missedIdea}`;
}

export function buildMistakePuzzles(
  tree: AnalysisTree,
  evaluations: PositionEvaluation[],
  reviewColor: "white" | "black"
) {
  const evaluationByNode = new Map(evaluations.map((evaluation) => [evaluation.nodeId, evaluation]));
  const ids = mainlineNodeIds(tree);
  const puzzles: MistakePuzzle[] = [];

  for (let index = 1; index < ids.length; index += 1) {
    const beforeNode = tree.nodes[ids[index - 1]];
    const afterNode = tree.nodes[ids[index]];
    if (!beforeNode || !afterNode || afterNode.origin !== "original" || !afterNode.uci || !afterNode.san) continue;
    const moveColor = afterNode.ply % 2 ? "white" : "black";
    if (moveColor !== reviewColor) continue;

    const before = evaluationByNode.get(beforeNode.id);
    const after = evaluationByNode.get(afterNode.id);
    if (!before || !after || !before.bestMoveUci) continue;
    const acceptedMovesUci = before.acceptedMovesUci?.length ? before.acceptedMovesUci : [before.bestMoveUci];
    if (acceptedMovesUci.includes(afterNode.uci)) continue;
    const beforeCp = evaluationAsCentipawns(before);
    const afterCp = evaluationAsCentipawns(after);
    if (beforeCp === null || afterCp === null) continue;
    const loss = Math.max(0, Math.round(reviewColor === "white" ? beforeCp - afterCp : afterCp - beforeCp));
    const severity = classifyCentipawnLoss(loss);
    if (!severity || severity === "inaccuracy") continue;
    const bestMoveSan = sanForUci(beforeNode.fen, before.bestMoveUci);

    puzzles.push({
      id: `mistake-${afterNode.id}`,
      beforeNodeId: beforeNode.id,
      afterNodeId: afterNode.id,
      ply: afterNode.ply,
      moveNumber: Math.ceil(afterNode.ply / 2),
      color: moveColor,
      fen: beforeNode.fen,
      playedMoveSan: afterNode.san,
      playedMoveUci: afterNode.uci,
      bestMoveSan,
      bestMoveUci: before.bestMoveUci,
      acceptedMovesUci,
      bestLineSan: before.bestLineSan,
      explanation: explainMistake({
        playedMoveSan: afterNode.san,
        bestMoveSan,
        replyLineSan: after.bestLineSan,
        centipawnLoss: loss
      }),
      centipawnLoss: loss,
      severity
    });
  }

  return puzzles.sort((left, right) => left.ply - right.ply);
}
