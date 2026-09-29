// Actual analysis workspace and teacher shell, using local-only fixture data.
import { createRoot } from 'react-dom/client';
import { Chess } from 'chess.js';
import { AppShell } from '../../components/AppShell';
import { AnalysisWorkspace } from '../../chess/components/AnalysisWorkspace';
import { createAnalysisTree } from '../../chess/analysis/tree';
import { Button } from '../../components/Button';
const chess = new Chess();
const initialFen = chess.fen();
const moves = ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Nf6', 'd3', 'Bc5', 'O-O', 'd6'].map(san => {
  const move = chess.move(san);
  return {...move, fen:chess.fen(), uci:move.from+move.to};
});
window.fetch = async () => Response.json({live:false});
createRoot(document.getElementById('root')).render(
  <AppShell title="Internal Game Analysis" subtitle="Review a completed student game without changing its source record." variant="admin">
    <AnalysisWorkspace initialTree={createAnalysisTree(initialFen,moves)} title="Student vs Alex" subtitle="Sep 30, 2026 · LOSS by checkmate · 10 min" gameMode reviewColor="white"
      actions={<><Button variant="ghost" href="/admin/students">Back to student</Button><Button variant="secondary">Add to Study</Button><Button variant="ghost" href="/admin/studies">All studies</Button></>}/>
  </AppShell>
);
