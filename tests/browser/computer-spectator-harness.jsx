// Real gameplay, publisher, validation, teacher transforms and spectator UI; synthetic storage only.
import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { VsComputerGame } from '../../chess/components/VsComputerGame';
import { LiveGameSpectator } from '../../chess/components/LiveGameSpectator';
import { AdminLiveGames } from '../../chess/components/AdminLiveGames';
import { AppShell } from '../../components/AppShell';
import { publishComputerGamePresence, listTeacherComputerGames, getTeacherComputerGame } from '../../chess/persistence/computerGamePresenceServer';

const storageKey = 'computer-spectator-fixture';
const studentId = '56be1301-448a-4f10-b211-de23b8387bf5';
const read = () => JSON.parse(localStorage.getItem(storageKey) || 'null');
const calls = [];
window.__computerPresenceClient = {
  from(table) {
    let rows = table === 'students' ? [{ id: studentId, display_name: 'OpeningExplorer', is_active: true }] : [read()].filter(Boolean);
    const query = {
      select() { return query; }, order() { return query; }, in() { return query; },
      eq(field, value) { rows = rows.filter(row => row[field] === value); return query; },
      gte(field, value) { rows = rows.filter(row => row[field] >= value); return query; },
      maybeSingle() { return Promise.resolve({ data: rows[0] ?? null, error: null }); },
      then(resolve) { return Promise.resolve({ data: rows, error: null }).then(resolve); }
    };
    return query;
  },
  async rpc(name, input) {
    const old = read();
    const accepted = !old || (old.game_id === input.p_game_id && input.p_version > old.version && (old.status === 'active' || input.p_status === old.status)) || (old.game_id !== input.p_game_id && input.p_started_at > old.started_at);
    if (accepted) localStorage.setItem(storageKey, JSON.stringify({ student_id: input.p_student_id, game_id: input.p_game_id, version: input.p_version, status: input.p_status, bot_id: input.p_bot_id, human_color: input.p_human_color, time_control_id: input.p_time_control_id, started_at: input.p_started_at, updated_at: new Date().toISOString(), move_count: input.p_snapshot.moves.length, snapshot: input.p_snapshot }));
    return { data: accepted, error: null };
  }
};
window.fetch = async (url, options = {}) => {
  const path = String(url);
  calls.push({ path, at: Date.now(), keepalive: options.keepalive ?? false });
  try {
    if (path === '/api/student/computer-game-presence') return Response.json({ ok: true, ...await publishComputerGamePresence(studentId, JSON.parse(options.body)) });
    if (path === '/api/admin/live-games') return Response.json({ ok: true, games: await listTeacherComputerGames() });
    if (path.startsWith('/api/admin/live-games/')) return Response.json({ ok: true, game: await getTeacherComputerGame(path.split('/').at(-1)) });
    if (path === '/api/student/chess-games') return Response.json({ ok: true, gameId: 'preview-completed-game', unlockedBotIds: ['pawny'] });
    return Response.json({ ok: true, celebrations: [], live: false });
  } catch (error) { return Response.json({ ok: false, error: error.message }, { status: error.status || 500 }); }
};

function Trace() {
  const [value, setValue] = useState('');
  useEffect(() => { const id = setInterval(() => setValue(JSON.stringify({ row: read(), calls })), 250); return () => clearInterval(id); }, []);
  return <output id="computer-presence-trace" className="sr-only">{value}</output>;
}
function Preview() {
  const student = location.pathname.startsWith('/student');
  const gameId = location.pathname.startsWith('/admin/live-games/') ? location.pathname.split('/').at(-1) : null;
  return <>
    <nav className="flex gap-4 bg-slate-950 p-3 text-sm text-cyan-200"><a href="/student/play/computer">Student preview</a><a href="/admin/live-games">Teacher Live Games</a></nav>
    {student ? <AppShell variant="student" title="Play a Computer" subtitle="Synthetic student preview"><VsComputerGame studentName="OpeningExplorer" studentAvatar={{ studentId, equippedItems: {} }} avatarItems={[]} initialUnlockedBotIds={['pawny']} /></AppShell> : <AppShell variant="admin" title={gameId ? 'Watch Live Game' : 'Live Games'} subtitle="Watch students playing each other or computer opponents without affecting play.">{gameId ? <LiveGameSpectator gameId={gameId} /> : <AdminLiveGames initialGames={[]} adminActionToken="preview" />}</AppShell>}
    <Trace />
  </>;
}
createRoot(document.getElementById('root')).render(<StrictMode><Preview /></StrictMode>);
