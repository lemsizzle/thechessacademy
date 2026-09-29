// Local-only student journey. Requests and records are isolated from production.
import { createRoot } from 'react-dom/client';
import { Chess } from 'chess.js';
import { Sidebar } from '../../components/Sidebar';
import { StudentNavigation } from '../../components/student/StudentNavigation';
import { StudentMenuNavigation } from '../../components/student/StudentMenuNavigation';
import { PlayModeGrid } from '../../chess/components/PlayModeGrid';
import { VsComputerGame } from '../../chess/components/VsComputerGame';
import { LiveChessGame } from '../../chess/components/LiveChessGame';
import { ChessHistoryDashboard } from '../../chess/components/ChessHistoryDashboard';
import { GameAnalysisLoader } from '../../chess/components/GameAnalysisLoader';

const initialFen = new Chess().fen();
const chess = new Chess();
const moves = ['f3', 'e5', 'g4', 'Qh4#'].map(san => { const m = chess.move(san); return { ...m, color: m.color === 'w' ? 'white' : 'black', fen: chess.fen(), uci: m.from + m.to }; });
const sample = { id: 'fixture-live', playerId: 'student-a', opponentName: 'Alex', opponentType: 'student', playerColor: 'white', gameMode: 'live', result: 'loss', resultReason: 'checkmate', completedAt: '2026-09-29T08:00:00Z', timeControl: { name: '10 + 0' }, initialFen, moves, moveCount: 2 };
const params = new URLSearchParams(location.search);
const stored = () => JSON.parse(sessionStorage.getItem('fixture-game-history') || '[]');
window.fetch = async (url, options = {}) => {
  const path = String(url);
  if (path === '/api/student/chess-games' && options.method === 'POST') {
    await new Promise(resolve => setTimeout(resolve, 800));
    if (params.has('save-error')) return Response.json({error:'Fixture save failed.'}, {status:503});
    const payload = JSON.parse(options.body);
    const replay = new Chess(payload.initialFen);
    const moves = payload.moves.map(move => { const m = replay.move(move); return { ...m, color: m.color === 'w' ? 'white' : 'black', fen: replay.fen(), uci: m.from + m.to }; });
    const record = {...payload, id:'fixture-bot', playerId:'student-a', opponentType:'computer', gameMode:'live', timeControl:{name:'No clock'}, moves, moveCount:Math.ceil(moves.length/2)};
    sessionStorage.setItem('fixture-game-history', JSON.stringify([record]));
    return Response.json({gameId:record.id});
  }
  if (path.startsWith('/api/student/chess-history')) {
    if (params.has('history-error')) return Response.json({error:'Fixture history unavailable.'}, {status:503});
    const query = new URL(path, location.origin).searchParams;
    const all = params.has('empty') ? [] : [...stored(), sample];
    const games = all.filter(game => (query.get('mode') === 'all' || game.opponentType === query.get('mode')) && (query.get('result') === 'all' || game.result === query.get('result')));
    return Response.json({games, summary:{total:all.length,wins:0,draws:0,losses:all.length,winRate:0}, pagination:{page:1,totalPages:1,total:games.length}});
  }
  if (path.startsWith('/api/chess/games/')) {
    const game = [...stored(), sample].find(game => path.endsWith(game.id));
    return Response.json(game ? {game} : {error:'Game not found.'}, {status:game ? 200 : 404});
  }
  if (path.startsWith('/api/student/live-games/')) return Response.json({game:{
    ...sample, status:'completed', version:1, realtimeTopic:'', viewer:{id:'student-a',color:'white'},
    players:{white:{id:'student-a',name:'Student',avatar:null},black:{id:'student-b',name:'Alex',avatar:null}}, avatarItems:[],
    fen:chess.fen(), activeColor:'white', clocks:{whiteMs:180000,blackMs:180000}, winnerColor:'black',
    arenaTournamentId:params.has('arena') ? 'fixture-arena' : null, gameMode:params.has('correspondence') ? 'correspondence' : 'live', serverNow:new Date().toISOString()
  }});
  if (path.includes('/presence')) return Response.json({queue:{tournamentStatus:'finished',queueEnabled:false,points:0}});
  return Response.json({messages:[], participants:[]});
};
function Page() {
  if (location.pathname.endsWith('/analysis')) return <GameAnalysisLoader gameId={location.pathname.split('/').at(-2)} basePath="/student"/>;
  if (location.pathname.endsWith('/history')) return <><h1 className="mb-4 text-2xl font-black">Game History</h1><ChessHistoryDashboard/></>;
  if (location.pathname.includes('/live/')) return <LiveChessGame gameId="fixture-live" mode={params.has('correspondence') ? 'correspondence' : 'live'}/>;
  return <><PlayModeGrid/><section id="computer-game"><VsComputerGame studentName="Student" studentAvatar={null} avatarItems={[]} initialUnlockedBotIds={['pawny']}/></section></>;
}
createRoot(document.getElementById('root')).render(<StudentMenuNavigation><div className="student-portal-shell academy-grid min-h-screen"><div className="flex min-h-screen"><Sidebar variant="student"/><div className="min-w-0 flex-1"><StudentNavigation studentName="Student" onLogout={()=>{}}/><main className="student-play-area mx-auto max-w-7xl px-4 pb-28 pt-6 md:pb-6 lg:px-6"><Page/></main></div></div></div></StudentMenuNavigation>);
