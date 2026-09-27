import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Chess } from 'chess.js';
import { AdminStudentRecentGames } from '../../components/admin/AdminStudentRecentGames';
import { GameAnalysisLoader } from '../../chess/components/GameAnalysisLoader';
const initialFen = new Chess().fen();
const chess = new Chess();
const moves = ['e4', 'e5', 'Nf3'].map(san => { const m = chess.move(san); return { san: m.san, from: m.from, to: m.to, uci: m.from + m.to, fen: chess.fen() }; });
const game = { id: 'fixture-game', playerId: 'student-a', opponentName: 'Friendly Bot', opponentType: 'computer', playerColor: 'white', gameMode: 'live', result: 'loss', resultReason: 'resignation', completedAt: '2026-09-27T08:00:00Z', timeControl: { name: '10 + 0' }, initialFen, moves };
let fail = new URLSearchParams(location.search).has('retry');
window.fetch = async (url) => {
  if (String(url).includes('/api/admin/students/')) {
    if(fail) { fail = false; return Response.json({error:'Please retry loading games.'}, {status:503}); }
    return Response.json({ games: String(url).includes('student-b') ? [] : [{...game, opponentName: String(url).includes('page=2') ? 'Older Opponent' : game.opponentName}], hasMore: !String(url).includes('page=2') });
  }
  if(String(url).includes('/api/chess/games/')) return Response.json({game});
  return Response.json({});
};
function Preview() {
  const [student, setStudent] = useState('student-a');
  return location.pathname.includes('/analysis') ? <GameAnalysisLoader gameId={game.id} basePath="/admin" /> : <><button onClick={()=>setStudent(student==='student-a'?'student-b':'student-a')}>Switch student</button><AdminStudentRecentGames key={student} studentId={student} studentName={student==='student-a'?'Alex':'Jamie'}/></>;
}
createRoot(document.getElementById('root')).render(<main className="mx-auto max-w-5xl p-4"><Preview/></main>);
