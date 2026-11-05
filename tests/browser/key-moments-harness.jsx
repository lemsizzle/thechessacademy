// Real analysis workspace and real local Stockfish. No student data or API writes.
import { createRoot } from "react-dom/client";
import { Chess } from "chess.js";
import { AnalysisWorkspace } from "../../chess/components/AnalysisWorkspace";
import { createAnalysisTree } from "../../chess/analysis/tree";

const fen = "3rk3/8/8/8/3Q4/8/8/7K w - - 0 1";
const chess = new Chess(fen);
const moves = ["Kh2", "Rxd4", "Kg3"].map((san, index) => {
  const move = chess.move(san);
  return { ...move, color: move.color === "w" ? "white" : "black", ply: index + 1, fenAfter: chess.fen() };
});
window.fetch = async () => Response.json({});
createRoot(document.getElementById("root")).render(
  <AnalysisWorkspace initialTree={createAnalysisTree(fen, moves)} title="Key moment practice" gameMode reviewColor="white" />
);
