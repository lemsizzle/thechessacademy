// Real game screens in the real student shell; all network data stays local.
import { createRoot } from 'react-dom/client';
import { Chess } from 'chess.js';
import { Sidebar } from '../../components/Sidebar';
import { StudentNavigation } from '../../components/student/StudentNavigation';
import { TopNav } from '../../components/TopNav';
import { StudentMenuNavigation, StudentMenuPage } from '../../components/student/StudentMenuNavigation';
import { VsComputerGame } from '../../chess/components/VsComputerGame';
import { PlayModeGrid } from '../../chess/components/PlayModeGrid';
import { LiveChessGame } from '../../chess/components/LiveChessGame';
import { LiveGameSpectator } from '../../chess/components/LiveGameSpectator';
import { gameMoves } from '../../chess/game/rules';

const area = new URLSearchParams(location.search).get('area') || 'bot';
// Fault injection for engine recovery QA. Subsequent workers use real Stockfish.
const engineFailure = new URLSearchParams(location.search).get('engineFailure');
if (engineFailure) {
  const NativeWorker = window.Worker;
  let first = true;
  window.Worker = class {
    constructor(...args) {
      if (!first) {
        const worker = new NativeWorker(...args);
        worker.addEventListener('message', event => {
          if (String(event.data).startsWith('bestmove ')) window.audit.engineBestMoves = (window.audit.engineBestMoves ?? 0) + 1;
        });
        return worker;
      }
      first = false;
    }
    postMessage(command) {
      if (engineFailure === 'startup') return;
      if (command === 'uci') queueMicrotask(() => this.onmessage?.({ data: 'uciok' }));
      if (command === 'isready') queueMicrotask(() => this.onmessage?.({ data: 'readyok' }));
      if (command.startsWith('go ') && engineFailure === 'crash') queueMicrotask(() => this.onerror?.());
    }
    terminate() {}
  };
}
// The fixture server uses a generic main wrapper; the real shell supplies its own.
const fixtureWrapper = document.getElementById('root').parentElement;
if (fixtureWrapper.tagName === 'MAIN') {
  const wrapper = document.createElement('div');
  wrapper.append(...fixtureWrapper.childNodes);
  fixtureWrapper.replaceWith(wrapper);
}
const initial = new Chess().fen();
const chess = new Chess();
const avatar = { studentId: 'white', equippedItems: {} };
const now = () => new Date().toISOString();
const player = (id, name) => ({ id, name, avatar: { studentId: id, equippedItems: {} } });
const game = {
  id: 'fixture', status: 'active', version: 1, challengeCode: 'fixture', realtimeTopic: '',
  gameMode: area === 'correspondence' ? 'correspondence' : 'live',
  daysPerMove: area === 'correspondence' ? 3 : null,
  turnDeadlineAt: area === 'correspondence' ? new Date(Date.now() + 259200000).toISOString() : null,
  viewer: { id: 'white', color: 'white' },
  players: { white: player('white', 'Puzzle Explorer'), black: player('black', 'Jamie') },
  avatarItems: [], timeControl: { id: '10+0', name: '10 + 0', initialMs: 600000, incrementMs: 0 },
  initialFen: initial, fen: initial, moves: [], activeColor: 'white',
  clocks: { whiteMs: 600000, blackMs: 600000, startedAt: now() },
  drawOfferedBy: null, winnerColor: null, resultReason: null,
  startedAt: now(), completedAt: null, serverNow: now(),
  arenaTournamentId: area === 'arena' ? 'arena-fixture' : null,
  matchmaking: true, rated: false, rematchRequestedBy: null, rematchGameId: null, rematchOfGameId: null,
};
const messages = [{ id: 'welcome', senderRole: 'teacher', senderName: 'Coach Lem', message: 'Good luck, everyone!', createdAt: now() }];
window.audit = { requests: [], moveRequests: [], savedGames: [], messages, game };
function updatePosition(input) {
  chess.move(input);
  Object.assign(game, { fen: chess.fen(), moves: gameMoves(chess), activeColor: chess.turn() === 'w' ? 'white' : 'black', version: game.version + 1, serverNow: now() });
  return game;
}
window.audit.opponentMove = (san = 'e5') => { updatePosition(san); window.dispatchEvent(new Event('focus')); };
window.audit.setClock = milliseconds => { game.clocks.whiteMs = milliseconds; game.clocks.blackMs = milliseconds; game.clocks.startedAt = now(); game.version++; window.dispatchEvent(new Event('focus')); };
window.audit.setPosition = fen => {
  chess.load(fen);
  Object.assign(game, { initialFen: fen, fen, moves: [], activeColor: chess.turn() === 'w' ? 'white' : 'black', version: game.version + 1, serverNow: now() });
  window.dispatchEvent(new Event('focus'));
};
window.audit.finishGame = () => {
  Object.assign(game, { status: 'completed', winnerColor: 'white', resultReason: 'resignation', completedAt: now(), version: game.version + 1, serverNow: now() });
  window.dispatchEvent(new Event('focus'));
};
window.audit.offerDraw = () => { game.drawOfferedBy = 'black'; game.version++; window.dispatchEvent(new Event('focus')); };
window.audit.failNextMove = () => { window.audit.nextMoveError = 'Fixture move failed. Please try again.'; };
window.fetch = async (url, options = {}) => {
  const path = String(url), body = options.body ? JSON.parse(options.body) : {};
  window.audit.requests.push({ path, body, method: options.method || 'GET' });
  if (path.includes('/board-themes')) return Response.json({ ownedThemes: [] });
  if (path.includes('/displayed-badge')) return Response.json({ badge: null });
  if (path.includes('/live-status')) return Response.json({ live: false });
  if (path.includes('/computer-game-presence')) return Response.json({ ok: true });
  if (path.endsWith('/chat')) return Response.json({ messages, canChat: true });
  if (path.endsWith('/lobby')) {
    const message = { id: crypto.randomUUID(), senderRole: 'student', senderName: 'Puzzle Explorer', message: body.message, createdAt: now() };
    messages.push(message); return Response.json({ ok: true, message });
  }
  if (path.endsWith('/presence')) return Response.json({ queue: { gameId: 'fixture', status: 'playing', tournamentStatus: 'active', queueEnabled: true } });
  if (path.includes('/live-games/') || path.includes('/internal-arenas/')) {
    if (path.endsWith('/move')) {
      if (window.audit.nextMoveError) {
        const error = window.audit.nextMoveError;
        delete window.audit.nextMoveError;
        return Response.json({ error }, { status: 400 });
      }
      try { updatePosition({ from: body.from, to: body.to, promotion: body.promotion }); window.audit.moveRequests.push(body); }
      catch { return Response.json({ error: 'Illegal fixture move' }, { status: 400 }); }
    }
    if (path.endsWith('/action')) {
      if (body.action === 'resign') Object.assign(game, { status: 'completed', winnerColor: 'black', resultReason: 'resignation', completedAt: now(), version: game.version + 1 });
      if (body.action === 'offer_draw') Object.assign(game, { drawOfferedBy: 'white', version: game.version + 1 });
      if (body.action === 'decline_draw') Object.assign(game, { drawOfferedBy: null, version: game.version + 1 });
    }
    return Response.json({ ok: true, game: { ...game, serverNow: now() } });
  }
  if (path.includes('/chess-games')) {
    if (options.method === 'POST') window.audit.savedGames.push(body);
    return Response.json({ ok: true, gameId: 'fixture', unlockedBotIds: [] });
  }
  return Response.json({ events: [], awards: [], quests: [], incoming: [], outgoing: [], games: [] });
};

const gameScreen = area === 'bot'
  ? <div className="space-y-5"><PlayModeGrid /><section id="computer-game" className="scroll-mt-5" aria-labelledby="computer-game-title"><h2 id="computer-game-title" className="mb-3 text-lg font-black text-white">Computer</h2><VsComputerGame studentName="Puzzle Explorer" studentAvatar={avatar} avatarItems={[]} initialUnlockedBotIds={[]} /></section></div>
  : area === 'spectator'
    ? <LiveGameSpectator gameId="fixture" />
    : <LiveChessGame gameId="fixture" mode={area === 'correspondence' ? 'correspondence' : 'live'} />;
createRoot(document.getElementById('root')).render(
  area === 'spectator' ? <div className="academy-grid min-h-screen"><div className="flex min-h-screen"><Sidebar variant="admin" /><div className="min-w-0 flex-1"><TopNav variant="admin" /><main className="mx-auto w-full max-w-7xl px-4 py-6 lg:px-6"><div data-page-heading className="mb-6"><h1 className="text-2xl font-black text-white sm:text-3xl">Watch Live Game</h1><p className="mt-2 max-w-3xl text-sm text-slate-400 sm:text-base">Read-only teacher view with live moves and clocks.</p></div>{gameScreen}</main></div></div></div> :
  <StudentMenuNavigation>
    <div className="student-portal-shell academy-grid min-h-screen">
      <div className="flex min-h-screen">
        <Sidebar variant="student" />
        <div className="min-w-0 flex-1">
          <StudentNavigation studentName="Puzzle Explorer" onLogout={() => {}} />
          <main className="student-play-area mx-auto w-full max-w-7xl px-4 pb-28 pt-6 md:pb-6 lg:px-6">
            <div data-page-heading className="mb-6">
              <p className="text-xs font-bold uppercase text-cyan-100">Puzzle Explorer</p>
              <h1 className="mt-1 text-2xl font-black text-white">{area === 'bot' ? 'Play against a bot' : area === 'spectator' ? 'Watch Live Game' : 'Live Game'}</h1>
              <p className="mt-2 text-sm text-slate-400">{area === 'bot' ? 'Choose an opponent and play.' : 'Play chess with your Academy friends.'}</p>
            </div>
            <StudentMenuPage>{gameScreen}</StudentMenuPage>
          </main>
        </div>
      </div>
    </div>
  </StudentMenuNavigation>
);
