import { Chess } from "chess.js";
import type { AnalysisTree } from "@/chess/analysis/types";
import type { StockfishCandidate } from "@/chess/types";

export const MISTAKE_EQUIVALENT_MOVE_MARGIN_CP = 35;
export const MAX_KEY_MOMENTS = 3;

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
  solutionExplanation: string;
  centipawnLoss: number;
  severity: MistakeSeverity;
};

export function selectKeyMoments<T extends Pick<MistakePuzzle, "centipawnLoss" | "ply">>(puzzles: T[], limit = MAX_KEY_MOMENTS) {
  return [...puzzles]
    .sort((left, right) => right.centipawnLoss - left.centipawnLoss || left.ply - right.ply)
    .slice(0, Math.max(0, limit))
    .sort((left, right) => left.ply - right.ply);
}

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
  const firstReply = replyLineSan.trim().split(/\s+/)[0] ?? "";
  const replyIdea = firstReply.includes("#")
    ? `checkmate with ${firstReply}`
    : firstReply.includes("+")
      ? `check your king with ${firstReply}`
      : firstReply.includes("x")
        ? `win material with ${firstReply}`
        : /^O-O/.test(firstReply)
          ? `castle with ${firstReply} and make their king safer`
          : firstReply.startsWith("R")
            ? `activate a rook with ${firstReply}`
            : firstReply.startsWith("Q")
              ? `activate the queen with ${firstReply}`
              : firstReply.startsWith("B")
                ? `activate a bishop with ${firstReply}`
                : firstReply.startsWith("N")
                  ? `improve a knight with ${firstReply}`
                  : firstReply
                    ? `play ${firstReply} and improve their position`
                    : "get a much easier position";
  const consequence = `After ${playedMoveSan}, your opponent can ${replyIdea}.`;
  const advantage = centipawnLoss >= 10_000
      ? "This may decide the game."
    : (() => {
        const pawnValue = Math.max(1, Math.round(centipawnLoss / 100));
        const pawnWords = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine"];
        const amount = pawnValue === 1 ? "one pawn" : `${pawnWords[pawnValue] ?? "several"} pawns`;
        const size = centipawnLoss >= 250 ? "big" : "clear";
        return `That gives your opponent a ${size} advantage—about the value of ${amount}.`;
      })();
  const tip = bestMoveSan.includes("#")
    ? "Look at every check—you had a way to checkmate."
    : bestMoveSan.includes("+")
      ? "Before choosing a move, look at every check. A strong check was available here."
      : bestMoveSan.includes("x")
        ? "Before choosing a move, look for safe captures. A strong capture was available here."
        : /^O-O/.test(bestMoveSan)
          ? "Your king needs safety here. Look for a chance to castle."
          : firstReply
            ? `Try to find a move that stops ${firstReply} while keeping your pieces safe and active.`
            : "Try to keep your pieces protected and make it harder for your opponent to attack.";
  return `${consequence} ${advantage} ${tip}`;
}

export function explainBestMove({
  fen,
  bestMoveUci,
  bestMoveSan,
  bestLineSan
}: {
  fen: string;
  bestMoveUci: string;
  bestMoveSan: string;
  bestLineSan: string;
}) {
  const pieceNames = { p: "pawn", n: "knight", b: "bishop", r: "rook", q: "queen", k: "king" } as const;
  let capturedPiece: string | null = null;
  try {
    const match = /^([a-h][1-8])([a-h][1-8])([qrbn])?$/.exec(bestMoveUci);
    const move = match ? new Chess(fen).move({ from: match[1], to: match[2], promotion: match[3] }) : null;
    capturedPiece = move?.captured ? pieceNames[move.captured] : null;
  } catch {
    capturedPiece = null;
  }

  const reason = bestMoveSan.includes("#")
    ? `${bestMoveSan} is best because it checkmates the king and ends the game.`
    : bestMoveSan.includes("=")
      ? `${bestMoveSan} is best because it promotes your pawn to a stronger piece.`
      : capturedPiece && bestMoveSan.includes("+")
        ? `${bestMoveSan} captures a ${capturedPiece} and checks the king, so your opponent must respond.`
        : capturedPiece
          ? `${bestMoveSan} captures a ${capturedPiece} and keeps your pieces active.`
          : bestMoveSan.includes("+")
            ? `${bestMoveSan} checks the king, so your opponent must respond right away.`
            : /^O-O/.test(bestMoveSan)
              ? `${bestMoveSan} makes your king safer and brings your rook into the game.`
              : /^[NBRQ]/.test(bestMoveSan)
                ? `${bestMoveSan} puts your piece on a more useful square and improves your position.`
                : `${bestMoveSan} improves your position and makes your opponent's plan harder.`;
  const lineMoves = bestLineSan.trim().split(/\s+/);
  const reply = lineMoves[1];
  const followUp = lineMoves[2];
  if (!reply || !followUp) return reason;
  const check = followUp.includes("+") || followUp.includes("#") ? " with check" : "";
  return `${reason} After ${reply}, ${followUp} keeps the plan going${check}.`;
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
      solutionExplanation: explainBestMove({
        fen: beforeNode.fen,
        bestMoveUci: before.bestMoveUci,
        bestMoveSan,
        bestLineSan: before.bestLineSan
      }),
      centipawnLoss: loss,
      severity
    });
  }

  return selectKeyMoments(puzzles);
}
