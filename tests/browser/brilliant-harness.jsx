// Real game review and Stockfish, with a smothered-mate queen sacrifice. No API writes.
import { createRoot } from "react-dom/client";
import { Chess } from "chess.js";
import { AnalysisWorkspace } from "../../chess/components/AnalysisWorkspace";
import { createAnalysisTree } from "../../chess/analysis/tree";
import { AnalysisStockfishService } from "../../chess/engine/AnalysisStockfishService";
window.reviewEvaluations = [];
const analyze = AnalysisStockfishService.prototype.analyze;
AnalysisStockfishService.prototype.analyze = async function(fen, ms) {
  const lines = await analyze.call(this, fen, ms);
  window.reviewEvaluations.push({ fen, ms, lines });
  return lines;
};
const board = new Chess("q4r1k/6pp/4Q2N/8/8/8/6P1/7K w - - 0 1");
const fen = board.fen();
const moves = ["Qg8+", "Rxg8", "Nf7#"].map((san, index) => {
  const move = board.move(san);
  return { ...move, ply: 1 + index, color: move.color === "w" ? "white" : "black", fenAfter: board.fen() };
});
createRoot(document.getElementById("root")).render(<AnalysisWorkspace initialTree={createAnalysisTree(fen, moves)} title="Brilliant move review" gameMode reviewColor="white" />);
