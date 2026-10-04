// Actual shared boards and shells, with synthetic games and no production requests.
import { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Chess } from 'chess.js';
import { AppShell } from '../../components/AppShell';
import { LiveGameSpectator } from '../../chess/components/LiveGameSpectator';
import { LiveChessGame } from '../../chess/components/LiveChessGame';
import { VsComputerGame } from '../../chess/components/VsComputerGame';
import { BoardViewport } from '../../chess/components/BoardViewport';
import { AcademyChessboard } from '../../chess/components/AcademyChessboard';
import { Sidebar } from '../../components/Sidebar';
import { StudentNavigation } from '../../components/student/StudentNavigation';
import { StudentMenuNavigation } from '../../components/student/StudentMenuNavigation';

const chess = new Chess();
const initialFen = chess.fen();
const moves = ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Nf6'].map(san => {
  const move = chess.move(san);
  return { ...move, uci: move.from + move.to, color: move.color === 'w' ? 'white' : 'black', ply: chess.history().length, fenAfter: chess.fen() };
});
const startedAt = new Date().toISOString();
function snapshot() { return {
  id: 'resize-fixture', status: 'active', version: 1, realtimeTopic: '',
  viewer: { id: 'white', color: 'white' }, gameMode: 'live', challengeCode: 'TEST',
  players: { white: { id: 'white', name: 'OpeningExplorer', avatar: { studentId: 'white', equippedItems: {} } }, black: { id: 'black', name: 'Coach', avatar: { studentId: 'black', equippedItems: {} } } },
  avatarItems: [], timeControl: { id: '5+3', name: '5 + 3', initialMs: 300000, incrementMs: 3000 },
  initialFen, fen: chess.fen(), moves: [...moves], activeColor: chess.turn() === 'w' ? 'white' : 'black',
  clocks: { whiteMs: 300000, blackMs: 300000, startedAt },
  winnerColor: null, resultReason: null, startedAt, completedAt: null,
  rated: false, matchmaking: true, arenaTournamentId: null, serverNow: new Date().toISOString()
}; }
window.fetch = async (url, options = {}) => {
  if (String(url).endsWith('/move')) {
    const move = chess.move(JSON.parse(options.body));
    moves.push({ ...move, color: move.color === 'w' ? 'white' : 'black', ply: moves.length + 1, fenAfter: chess.fen() });
  }
  return /\/api\/(admin|student)\/live-games\//.test(String(url))
    ? Response.json({ ok: true, game: snapshot() }) : Response.json({ live: false });
};

function SizeTrace() {
  const output = useRef(null);
  useEffect(() => {
    let frame;
    const samples = [];
    const tick = () => {
      const column = document.querySelector('[data-board-column]');
      const board = document.querySelector('[data-chess-board]');
      if (column && board) {
        const c = column.getBoundingClientRect();
        const b = board.getBoundingClientRect();
        samples.push({ width: c.width, board: b.width, height: c.height, top: c.top + scrollY, cap: column.style.width });
        if (samples.length > 180) samples.shift();
        const recent = samples.slice(-60);
        const settled = recent.length === 60 && recent.every(s => s.width === recent[0].width);
        output.current.textContent = JSON.stringify({ viewport: [innerWidth, innerHeight], frames: samples.length,
          settled,
          changes: samples.slice(1).filter((s, i) => s.width !== samples[i].width).length,
          widths: [...new Set(samples.map(s => s.width))], recent: samples.slice(-6) });
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);
  return <output ref={output} id="size-trace" className="sr-only" />;
}

function PuzzleFixture() {
  const [fen, setFen] = useState(initialFen);
  return <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,640px)_minmax(300px,1fr)]">
    <BoardViewport maxWidth={640}><div className="aspect-square rounded-xl border p-2">
      <AcademyChessboard boardId="resize-puzzle" fen={fen} orientation="white" humanColor="white" interactive lastMove={null} allowDrawingArrows onMove={(from, to) => {
        const position = new Chess(fen);
        try { position.move({ from, to }); setFen(position.fen()); } catch { /* Illegal moves stay put. */ }
      }} />
    </div></BoardViewport><aside>Find a strong move.</aside>
  </div>;
}
const mode = new URLSearchParams(location.search).get('mode') || 'spectator';
const content = <>{mode === 'spectator' ? <LiveGameSpectator gameId="resize-fixture" /> : mode === 'live' ? <LiveChessGame gameId="resize-fixture" /> : mode === 'bot' ? <VsComputerGame studentName="Student" studentAvatar={{ studentId: 'white', equippedItems: {} }} avatarItems={[]} initialUnlockedBotIds={['pawny']} /> : <PuzzleFixture />}<SizeTrace /></>;
createRoot(document.getElementById('root')).render(mode === 'spectator'
  ? <AppShell variant="admin" title="Watch Live Game" subtitle="Read-only teacher view with live moves and clocks.">{content}</AppShell>
  : <StudentMenuNavigation><div className="student-portal-shell academy-grid min-h-screen"><div className="flex min-h-screen"><Sidebar variant="student" /><div className="min-w-0 flex-1"><StudentNavigation studentName="Student" onLogout={() => {}} /><main className="student-play-area mx-auto max-w-7xl px-4 pb-28 pt-6 md:pb-6 lg:px-6">{content}</main></div></div></div></StudentMenuNavigation>);
