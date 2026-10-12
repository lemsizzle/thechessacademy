// Actual trainer, menus, and chess validation; isolated API responses only.
import { createRoot } from 'react-dom/client';
import { Sidebar } from '../../components/Sidebar';
import { StudentNavigation } from '../../components/student/StudentNavigation';
import { StudentMenuNavigation, StudentMenuPage } from '../../components/student/StudentMenuNavigation';
import { PuzzleSurvival } from '../../components/training/PuzzleSurvival';
import { emptyPuzzleTrainingOverview } from '../../lib/puzzle-training/overview';
import { prepareTrainingPuzzle, validatePuzzleMove } from '../../lib/puzzle-training/engine';
import { forkPuzzle, pinPuzzle, skewerPuzzle } from '../fixtures/lichessPuzzles';

const puzzles = [forkPuzzle, pinPuzzle, skewerPuzzle];
const issued = new Map();
let nextIndex = 0;
window.audit = { requests: [], correctMoves: 0, incorrectMoves: 0, hints: 0 };
window.fetch = async (url, options = {}) => {
  const path = String(url), input = options.body ? JSON.parse(options.body) : {};
  window.audit.requests.push({ path, input });
  if (path.includes('/puzzle-training/puzzle?')) {
    const query = new URL(path, location.origin).searchParams;
    const row = puzzles.find(row => row.id === query.get('puzzleId')) ?? puzzles[nextIndex++ % puzzles.length];
    const token = crypto.randomUUID();
    issued.set(token, { row, mistakes: 0, hints: 0 });
    const position = prepareTrainingPuzzle(row);
    return Response.json({ puzzle: {
      id: row.id, displayFen: position.displayFen, orientation: position.orientation,
      sideToMove: position.sideToMove, prompt: 'Find the best move', sourceKind: 'lichess', token,
      daily: query.get('mode') === 'daily' ? { xp: 10, coins: 10, rewardClaimed: false } : null
    } });
  }
  if (path.endsWith('/puzzle-training/hint')) {
    const session = issued.get(input.token);
    session.hints++; window.audit.hints++;
    const move = session.row.moves[1];
    return Response.json({ token: input.token, hint: { source: move.slice(0, 2), ...(session.hints > 1 ? { destination: move.slice(2, 4) } : {}) } });
  }
  if (path.endsWith('/puzzle-training/move')) {
    const session = issued.get(input.token);
    const result = validatePuzzleMove(session.row, 1, input.move);
    if (!result.accepted) {
      session.mistakes++; window.audit.incorrectMoves++;
      return Response.json({ ...result, token: input.token, message: 'Try again. Look for a stronger move.' });
    }
    window.audit.correctMoves++;
    const next = issued.get(input.nextPuzzleToken);
    return Response.json({
      ...result, token: input.token, message: 'Correct! You found the tactic.',
      completion: { themes: session.row.themes, rating: session.row.rating, mistakes: session.mistakes, hintsUsed: session.hints, elapsedSeconds: 4 },
      ...(next ? { preparedNextPuzzle: { id: next.row.id, token: input.nextPuzzleToken } } : {})
    });
  }
  if (path.includes('/board-themes')) return Response.json({ ownedThemes: [] });
  if (path.includes('/puzzle-training/rewards?')) return Response.json({ xp: 0, puzzleCoins: 0, badgeCoins: 0, badges: [] });
  if (path.includes('/live-status')) return Response.json({ live: false });
  return Response.json({ events: [], awards: [], quests: [], incoming: [], outgoing: [], games: [] });
};

createRoot(document.getElementById('root')).render(
  <StudentMenuNavigation>
    <div className="student-portal-shell academy-grid min-h-screen">
      <div className="flex min-h-screen">
        <Sidebar variant="student" />
        <div className="min-w-0 flex-1">
          <StudentNavigation studentName="Puzzle Explorer" onLogout={() => {}} />
          <main className="student-play-area mx-auto w-full max-w-7xl px-4 pb-28 pt-6 md:pb-6 lg:px-6">
            <div data-page-heading className="mb-6">
              <p className="text-xs font-bold uppercase text-cyan-100">Puzzle Explorer</p>
              <h1 className="mt-1 text-2xl font-black text-white sm:text-3xl">Puzzle Training</h1>
              <p className="mt-2 max-w-3xl text-sm text-slate-400 sm:text-base">Train tactics, build pattern memory, and plan perfect routes before you move.</p>
            </div>
            <StudentMenuPage><PuzzleSurvival initialOverview={emptyPuzzleTrainingOverview} /></StudentMenuPage>
          </main>
        </div>
      </div>
    </div>
  </StudentMenuNavigation>
);
