import { createRoot } from "react-dom/client";
import { Chess } from "chess.js";
import { AdminLiveGames } from "../../chess/components/AdminLiveGames";
import { AppShell } from "../../components/AppShell";
import { teacherPreviewGames, parseTeacherPreviewIds } from "../../chess/live/teacherPreviews";

const channels = new Map();
window.__teacherPreviewRealtime = {
  channel(topic) {
    const channel = { topic, on(_kind, _filter, listener) { channel.listener = listener; return channel; }, subscribe(listener) { channel.status = listener; channels.set(topic, channel); queueMicrotask(() => listener("SUBSCRIBED")); return channel; } };
    return channel;
  },
  removeChannel(channel) { channels.delete(channel.topic); }
};
const gameId = i => `${i === 2 ? "computer-" : ""}00000000-0000-4000-8000-${String(i).padStart(12, "0")}`;
let records = Array.from({ length: 5 }, (_, index) => {
  const i = index + 1;
  const chess = new Chess();
  for (const move of ["e4", "e5", "Nf3", "Nc6"].slice(0, index)) chess.move(move);
  const last = chess.history({ verbose: true }).at(-1);
  return {
    id: gameId(i), computerPractice: i === 2,
    players: { white: { id: `student-${i}`, name: ["Alex", "Blair", "Casey", "Devon", "Emery"][index] }, black: { id: `other-${i}`, name: i === 2 ? "Pawny" : `Opponent ${i}` } },
    timeControl: { name: "5 + 3", initialMs: 300000, incrementMs: 3000 }, activeColor: chess.turn() === "w" ? "white" : "black", moveCount: index, rated: false, matchmaking: false, arenaTournamentId: i === 3 ? "arena" : null,
    startedAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    preview: { fen: chess.fen(), activeColor: chess.turn() === "w" ? "white" : "black", lastMove: last ? [last.from, last.to] : null, clocks: { whiteMs: 290000, blackMs: 280000, startedAt: new Date().toISOString() }, serverNow: new Date().toISOString(), realtimeTopic: i === 2 ? "" : `preview-${i}` }
  };
});
const originalFetch = window.fetch.bind(window);
const calls = [];
let fail = false, gate = null;
function list(ids = []) {
  const chosen = new Set(teacherPreviewGames(records, ids).map(g => g.id));
  return records.map(g => ({ ...g, preview: chosen.has(g.id) ? { ...g.preview, serverNow: new Date().toISOString() } : undefined }));
}
window.fetch = async (url, options = {}) => {
  const path = new URL(String(url), location.origin);
  if (!path.pathname.startsWith('/api/')) return originalFetch(url, options);
  calls.push({ url: path.pathname, at: Date.now(), method: options.method || 'GET' });
  if (path.pathname === '/api/admin/live-games') {
    const response = { ok: true, games: list(parseTeacherPreviewIds(path.searchParams.get('watch'))) };
    if (gate) await gate;
    return fail ? Response.json({ error: 'Connection interrupted. Retrying…' }, { status: 503 }) : Response.json(response);
  }
  if (path.pathname === '/api/tournaments/live-status') return Response.json({ live: false });
  return Response.json({});
};
window.__multiBoardQA = {
  calls, gameId,
  move(i, san) { const game = records.find(g => g.id === gameId(i)); const chess = new Chess(game.preview.fen); const move = chess.move(san); game.preview = { ...game.preview, fen: chess.fen(), activeColor: chess.turn() === "w" ? "white" : "black", lastMove: [move.from, move.to] }; game.activeColor = game.preview.activeColor; game.moveCount++; records = [game, ...records.filter(g => g !== game)]; channels.get(game.preview.realtimeTopic)?.listener(); },
  finish(i) { const old = records.find(g => g.id === gameId(i)); records = records.filter(g => g !== old); channels.get(old?.preview.realtimeTopic)?.listener(); },
  reverse() { records.reverse(); },
  fail(value) { fail = value; },
  hold() { gate = new Promise(resolve => { window.__multiBoardQA.release = () => { gate = null; resolve(); }; }); },
  broadcast() { for (const channel of channels.values()) channel.listener(); },
  empty() { records = []; }
};
createRoot(document.getElementById('root')).render(<AppShell variant="admin" title="Live Games" subtitle="Watch students playing each other or computer opponents without affecting play."><AdminLiveGames initialGames={list()} adminActionToken="local-fixture" /></AppShell>);
