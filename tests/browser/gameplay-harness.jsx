// Local-only interaction fixture. No real students, games, or network writes.
import React, { useState, useEffect, useRef } from "react";
import { createRoot } from "react-dom/client";
import { Chess } from "chess.js";
import { AcademyChessboard } from "../../chess/components/AcademyChessboard";
import { LiveChessGame } from "../../chess/components/LiveChessGame";

function BoardFixture() {
  const initial = new Chess(); initial.move("e4");
  const [config, setConfig] = useState({ fen: initial.fen(), orientation: "white", humanColor: "white", key: 0, interactive: true });
  const [moves, setMoves] = useState([]);
  const replyDuringDrag = useRef(false);
  window.boardTest = {
    reset: (fen = initial.fen(), orientation = "white", humanColor = "white") => {
      setConfig((old) => ({ fen, orientation, humanColor, key: old.key + 1, interactive: true })); setMoves([]);
    },
    reply: (san) => setConfig((old) => { const chess = new Chess(old.fen); chess.move(san); return { ...old, fen: chess.fen() }; }),
    lock: () => setConfig((old) => ({ ...old, interactive: false })),
    moves,
    fen: config.fen
  };
  return <div style={{ width: "100%", maxWidth: 480 }}>
    <div><button onClick={() => window.boardTest.reset()}>Reset</button><button onClick={() => window.boardTest.reply("e5")}>Opponent e5</button><button onClick={() => { replyDuringDrag.current = true; }}>Reply during next drag</button><button onClick={() => window.boardTest.lock()}>Lock board</button></div>
    <div onPointerMoveCapture={(event) => { if (event.buttons === 1 && replyDuringDrag.current) { replyDuringDrag.current = false; setTimeout(() => window.boardTest.reply("e5"), 60); } }}>
    <AcademyChessboard key={config.key} boardId="test-board" fen={config.fen} orientation={config.orientation} humanColor={config.humanColor} interactive={config.interactive} lastMove={null} allowPremoves
      onMove={(from, to) => {
        setMoves((old) => [...old, { from, to, fen: config.fen }]);
        const chess = new Chess(config.fen);
        if (chess.turn() !== config.humanColor[0]) return;
        try { chess.move({ from, to, promotion: "q" }); setConfig({ ...config, fen: chess.fen() }); } catch { /* Illegal moves stay put. */ }
      }} />
    </div>
    <output id="moves">{JSON.stringify(moves)}</output>
  </div>;
}

const gameMode = location.search.includes("correspondence") ? "correspondence" : "live";
const serverChess = new Chess();
const player = (id, name) => ({ id, name, slug: id, avatar: null, rating: 1200 });
let version = 1;
let moves = [];
let request;
let overrideSnapshot;
function snapshot() {
  return {
    id: "fixture", challengeCode: "TEST", status: "active", version, realtimeTopic: "", gameMode,
    daysPerMove: gameMode === "correspondence" ? 3 : null, turnDeadlineAt: gameMode === "correspondence" ? new Date(Date.now() + 259200000).toISOString() : null, viewer: { id: "white", color: "white" },
    players: { white: player("white", "Student"), black: player("black", "Opponent") }, avatarItems: [],
    timeControl: { id: "3+2", name: "3 + 2", initialMs: 180000, incrementMs: 2000 },
    initialFen: new Chess().fen(), fen: serverChess.fen(), moves: [...moves], activeColor: serverChess.turn() === "w" ? "white" : "black",
    clocks: { whiteMs: 180000, blackMs: 180000, startedAt: new Date().toISOString() },
    drawOfferedBy: null, winnerColor: null, resultReason: null, startedAt: new Date().toISOString(), completedAt: null,
    matchmaking: false, arenaTournamentId: null, rematchRequestedBy: null, rematchGameId: null, rematchOfGameId: null, serverNow: new Date().toISOString()
  };
}
function play(move) {
  const result = serverChess.move(move);
  moves.push({ ...result, color: result.color === "w" ? "white" : "black", ply: moves.length + 1, fen: serverChess.fen() }); version++;
}
window.liveTest = {
  requests: [],
  acknowledge: (reject = false) => {
    if (!request) throw new Error("No pending move");
    const pending = request; request = null;
    if (!reject) play(pending.body);
    pending.resolve(new Response(JSON.stringify(reject ? { error: "Rejected for fixture" } : { ok: true, game: snapshot() }), { status: reject ? 409 : 200 }));
  },
  reply: (san) => { play(san); window.dispatchEvent(new Event("focus")); },
  snapshot,
  stale: (game) => { overrideSnapshot = game; window.dispatchEvent(new Event("focus")); }
};
window.fetch = async (url, options = {}) => {
  if (String(url).endsWith("/move")) {
    const body = JSON.parse(options.body); window.liveTest.requests.push(body);
    return new Promise((resolve) => { request = { body, resolve }; });
  }
  if (String(url).includes("/api/student/live-games/")) {
    const game = overrideSnapshot ?? snapshot(); overrideSnapshot = null;
    return new Response(JSON.stringify({ ok: true, game }));
  }
  return new Response(JSON.stringify({}), { status: 404 });
};
function LiveFixture() {
  const [, tick] = useState(0);
  const initial = useRef(snapshot());
  useEffect(() => { const timer = setInterval(() => tick((n) => n + 1), 100); return () => clearInterval(timer); }, []);
  return <><div><button onClick={() => window.liveTest.acknowledge()}>Confirm pending move</button><button onClick={() => window.liveTest.acknowledge(true)}>Reject pending move</button><button onClick={() => window.liveTest.reply("e5")}>Opponent e5</button><button onClick={() => window.liveTest.stale(initial.current)}>Deliver stale snapshot</button></div><output id="requests">Requests: {JSON.stringify(window.liveTest.requests)}</output><LiveChessGame gameId="fixture" mode={gameMode} /></>;
}
createRoot(document.getElementById("root")).render(location.search.includes("live") ? <LiveFixture /> : <BoardFixture />);
