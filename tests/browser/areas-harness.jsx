// Actual UI components with isolated API responses. No production writes.
import { StockfishService } from '../../chess/engine/StockfishService';
import { BOT_DIFFICULTIES } from '../../chess/game/config';
import { createRoot } from 'react-dom/client';
import { Chess } from 'chess.js';
import { AnalysisWorkspace } from '../../chess/components/AnalysisWorkspace';
import { createEmptyAnalysisTree } from '../../chess/analysis/tree';
import { AdaptiveReviewTrainer } from '../../chess/components/AdaptiveReviewTrainer';
import { StarWarsTraining } from '../../components/training/StarWarsTraining';
import { HideAndSeekTraining } from '../../components/training/HideAndSeekTraining';
import { PuzzleSurvival } from '../../components/training/PuzzleSurvival';
import { emptyPuzzleTrainingOverview } from '../../lib/puzzle-training/overview';
import { AdventureBoardChallenge } from '../../components/adventure/AdventureBoardChallenge';
import { AdventureBossGame } from '../../components/adventure/AdventureBossGame';
import { ADVENTURE_CHALLENGES } from '../../adventure/content';
import { VsComputerGame } from '../../chess/components/VsComputerGame';
import { LiveGameSpectator } from '../../chess/components/LiveGameSpectator';
import { starWarsPuzzleForScore, findStarWarsSolution, initialStarWarsState } from '../../lib/puzzle-training/starWars';
import { calculateHideAndSeekSafeSquares, calculateHideAndSeekScore } from '../../lib/puzzle-training/hideAndSeek';
const mode = new URLSearchParams(location.search).get('area') || 'analysis';
const noop = () => { };
const initial = new Chess().fen();
const requests = [];
window.audit = { requests, tree: null };
const pieces = [{ piece: 'bR', square: 'a8' }, { piece: 'bN', square: 'd5' }, { piece: 'bK', square: 'h8' }];
const player = (id) => ({ id, name: id, slug: id, avatar: null, rating: 1200 });
const game = { id: 'fixture', status: 'active', version: 1, realtimeTopic: '', gameMode: 'live', daysPerMove: null, turnDeadlineAt: null, players: { white: player('white'), black: player('black') }, avatarItems: [], timeControl: { id: '3+2', name: '3 + 2', initialMs: 180000, incrementMs: 2000 }, initialFen: initial, fen: initial, moves: [], activeColor: 'white', clocks: { whiteMs: 180000, blackMs: 180000, startedAt: new Date().toISOString() }, drawOfferedBy: null, winnerColor: null, resultReason: null, startedAt: new Date().toISOString(), completedAt: null, serverNow: new Date().toISOString() };
window.fetch = async (url, options = {}) => {
    const path = String(url), body = options.body ? JSON.parse(options.body) : {};
    requests.push({ path, body, method: options.method || 'GET' });
    let data = {};
    if (path.includes('adaptive-review'))
        data = options.method === 'POST' ? { outcome: 'correct', bestMoveSan: 'e4', bestMoveUci: 'e2e4', solutionExplanation: 'Control the center.', bestLineSan: 'e4 e5' } : { items: [{ id: 'review', fen: initial, color: 'white', severity: 'mistake', sourceKind: 'survival', playedMoveUci: 'a2a3', playedMoveSan: 'a3', explanation: 'Improve the center.' }], summary: { total: 1, due: 1, learning: 1, review: 0, mastered: 0, attempts: 0, correct: 0, accuracy: 0 } };
    else if (path.includes('/puzzle-training/puzzle'))
        data = { puzzle: { id: 'fixture', displayFen: initial, orientation: 'white', sideToMove: 'White', prompt: 'Play e4', sourceKind: 'lichess', token: 'fixture', daily: null } };
    else if (path.includes('/puzzle-training/move')) {
        const chess = new Chess(initial);
        chess.move({ from: body.from, to: body.to });
        data = { accepted: true, completed: true, token: 'done', positionFen: chess.fen(), message: 'Puzzle complete', completion: { themes: ['opening'], rating: 800, gameUrl: null, mistakes: 0, hintsUsed: 0, elapsedSeconds: 1 } };
    }
    else if (path.includes('/star-wars/start')) {
        const now = new Date().toISOString();
        data = { run: { runId: 'fixture', runVariant: 0, score: 0, personalBest: 0, mode: 'classic', timeLimitMs: null, startedAt: now, serverSentAt: now }, serverReceivedAt: now };
    }
    else if (path.includes('/star-wars/progress'))
        data = { result: { score: body.score || 1, personalBest: body.score || 1 } };
    else if (path.includes('/hide-and-seek/start')) {
        const now = new Date().toISOString();
        data = { round: { id: 'fixture', pieces, mode: body.mode, timeLimitMs: null, startedAt: now, expiresAt: new Date(Date.now() + 600000).toISOString() }, token: 'fixture', serverReceivedAt: now, serverSentAt: now };
    }
    else if (path.includes('/hide-and-seek/finish')) {
        const score = calculateHideAndSeekScore({ safeSquares: calculateHideAndSeekSafeSquares(pieces), selectedSquares: body.selectedSquares, elapsedMs: 1000, mode: 'classic' });
        data = { result: { ...score, mode: 'classic', personalBest: score.score, completedAt: new Date().toISOString() } };
    }
    else if (path.includes('/live-games/') || path.includes('/internal-arenas/'))
        data = { game };
    else if (path.includes('/chess-games'))
        data = { gameId: 'fixture', unlockedBotIds: [] };
    else if (path.includes('/board-themes'))
        data = { ownedThemes: [] };
    return new Response(JSON.stringify(data), { status: 200 });
};
const tree = createEmptyAnalysisTree(mode === 'promotion' ? '7k/P7/8/8/8/8/8/7K w - - 0 1' : initial);
const challenge = ADVENTURE_CHALLENGES[Object.keys(ADVENTURE_CHALLENGES)[0]];
window.audit.challenge = challenge;
window.audit.starSolution = () => { const p = starWarsPuzzleForScore(0, 0); return findStarWarsSolution(initialStarWarsState(p)); };
window.audit.safeSquares = calculateHideAndSeekSafeSquares(pieces);
const areas = { analysis: <AnalysisWorkspace initialTree={tree} title="Analysis fixture" onTreeChange={t => window.audit.tree = t}/>, promotion: <AnalysisWorkspace initialTree={tree} title="Promotion fixture" onTreeChange={t => window.audit.tree = t}/>, review: <AdaptiveReviewTrainer autoStart/>, star: <StarWarsTraining onExit={noop}/>, hide: <HideAndSeekTraining onExit={noop}/>, puzzle: <PuzzleSurvival initialOverview={emptyPuzzleTrainingOverview}/>, adventure: <AdventureBoardChallenge challenge={challenge} onComplete={() => window.audit.complete = true}/>, boss: <AdventureBossGame onFinishChapter={noop} onCheckmate={noop} onRetreat={noop}/>, bot: <VsComputerGame studentName="Fixture" studentAvatar={null} avatarItems={[]} initialUnlockedBotIds={[]}/>, spectator: <LiveGameSpectator gameId="fixture"/>, arena: <LiveGameSpectator gameId="fixture" role="student" tournamentId="fixture"/> };
createRoot(document.getElementById('root')).render(areas[mode]);
window.audit.engineMove = async () => { const service = new StockfishService(); try {
    const move = await service.requestMove(initial, BOT_DIFFICULTIES[0], { moveHistory: [] });
    const chess = new Chess(initial);
    return { move, legal: !!chess.move({ from: move.slice(0, 2), to: move.slice(2, 4), promotion: move[4] }) };
}
finally {
    service.terminate();
} };
