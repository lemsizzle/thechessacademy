// Local-only fixture: real game UI, completion validator, and adjustment policy.
// Scripted opponent and localStorage stand in for Stockfish and the saved-game DB.
import { createRoot } from 'react-dom/client';
import { Chess } from 'chess.js';
import { VsComputerGame } from '../../chess/components/VsComputerGame';
import { validateCompletedGame } from '../../chess/persistence/completedGame';
import { halloweenReductionsFromGames } from '../../chess/bots/halloweenAdaptation';

const RealDate = Date;
let offset = Date.parse('2026-10-26T10:00:00+07:00') - RealDate.now();
window.Date = class extends RealDate {
  constructor(...args) { super(...(args.length ? args : [RealDate.now() + offset])); }
  static now() { return RealDate.now() + offset; }
};
window.advanceFixtureTime = () => { offset += 180000; };
const script = new Chess();
const moves = 'e4 e5 Nf3 d6 d4 Bg4 dxe5 Bxf3 Qxf3 dxe5 Bc4 Nf6 Qb3 Qe7 Nc3 c6 Bg5 b5 Nxb5 cxb5 Bxb5+ Nbd7 O-O-O Rd8 Rxd7 Rxd7 Rd1 Qe6 Bxd7+ Nxd7 Qb8+ Nxb8 Rd8#'.split(' ').map(san => script.move(san));
window.fixtureStudentMoves = moves.filter(m => m.color === 'b').map(m => [m.from,m.to]);
window.audit = { engineConfigs: [], plies: 0, saves: [] };
window.fixtureBotMove = (fen, bot) => {
  window.audit.engineConfigs.push(bot);
  const move = moves.find(m => m.before === fen);
  if (!move) throw new Error('Unexpected fixture position');
  return move.from + move.to;
};
const key = 'halloween-adaptation-fixture-games';
const records = JSON.parse(localStorage.getItem(key) || '[]');
window.fetch = async (input, options = {}) => {
  const path = String(input);
  const body = options.body ? JSON.parse(options.body) : {};
  if (path.includes('computer-game-presence')) {
    window.audit.plies = body.moves?.length ?? window.audit.plies;
    return Response.json({ ok: true });
  }
  if (path.includes('/chess-games')) {
    try {
      const game = validateCompletedGame(body);
      records.push({ id: `fixture-${records.length}`, opponent_id: game.opponentId, player_color: game.playerColor,
        result: game.result, result_reason: game.resultReason, initial_fen: game.initialFen, pgn: game.pgn,
        takeback_count: game.takebackCount, hints_used: game.hintsUsed, started_at: game.startedAt,
        completed_at: game.completedAt, created_at: new Date().toISOString() });
      localStorage.setItem(key, JSON.stringify(records));
      const halloweenReductions = halloweenReductionsFromGames(records);
      window.audit.saves.push({ game, halloweenReductions });
      return Response.json({ ok: true, gameId: 'fixture-game', unlockedBotIds: [], halloweenReductions });
    } catch (error) { return Response.json({ error: error.message }, { status: 400 }); }
  }
  return Response.json({ events: [], awards: [], incoming: [], outgoing: [], games: [] });
};
createRoot(document.getElementById('root')).render(
  <div className="academy-grid min-h-screen p-3 sm:p-6">
    <p className="mb-4 text-sm text-slate-300">Halloween difficulty preview · local test data</p>
    <VsComputerGame studentName="Explorer" studentAvatar={{ equippedItems: {} }} avatarItems={[]} initialUnlockedBotIds={['pawny','so-pawny']}
      initialHalloweenReductions={halloweenReductionsFromGames(records)} />
  </div>
);
