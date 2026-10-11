// Real menus, launchers, puzzles and bot UI, isolated from production data.
import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Chess } from 'chess.js';
import { Sidebar } from '../../components/Sidebar';
import { StudentNavigation } from '../../components/student/StudentNavigation';
import { StudentMenuNavigation, StudentMenuPage } from '../../components/student/StudentMenuNavigation';
import { RouteLauncherDialog } from '../../components/student/RouteLauncherDialog';
import { PuzzleSurvival } from '../../components/training/PuzzleSurvival';
import { emptyPuzzleTrainingOverview } from '../../lib/puzzle-training/overview';
import { PlayModeGrid } from '../../chess/components/PlayModeGrid';
import { VsComputerGame } from '../../chess/components/VsComputerGame';

const fen = new Chess().fen();
window.fetch = async (url, options = {}) => {
  const path = String(url);
  let data = {};
  if (path.includes('/puzzle-training/puzzle')) data = { puzzle: { id: 'fixture', displayFen: fen, orientation: 'white', sideToMove: 'White', prompt: 'Play e4', sourceKind: 'lichess', token: 'fixture', daily: null } };
  else if (path.includes('/board-themes')) data = { ownedThemes: [] };
  else if (path.includes('/live-status')) data = { live: false };
  else if (path.includes('/chess-games')) data = { gameId: 'fixture', unlockedBotIds: [] };
  else if (path.includes('/star-wars/start')) { const now = new Date().toISOString(); data = { run: { runId: 'fixture', runVariant: 0, score: 0, personalBest: 0, mode: 'classic', timeLimitMs: null, startedAt: now, serverSentAt: now }, serverReceivedAt: now }; }
  return Response.json(data);
};

function Page() {
  const [details, setDetails] = useState(false);
  if (location.pathname === '/student/training') return <PuzzleSurvival initialOverview={emptyPuzzleTrainingOverview} />;
  if (location.pathname === '/student/play') return <><PlayModeGrid /><section id="computer-game"><VsComputerGame studentName="Fixture" studentAvatar={{ studentId: 'fixture', equippedItems: {} }} avatarItems={[]} initialUnlockedBotIds={[]} /></section></>;
  if (location.pathname === '/student/quests') return <RouteLauncherDialog id="fixture-quests" navigationHref="/student/quests" eyebrow="Quests" title="Your quests" description="Fixture quest content" triggerLabel="Open your quests" triggerDescription="Open the quest list"><p>Quest list</p></RouteLauncherDialog>;
  return <><p>Destination: {location.pathname}{location.search}</p><button onClick={() => setDetails(true)}>Open details</button>{details && <p>Details are open</p>}</>;
}
createRoot(document.getElementById('root')).render(<StudentMenuNavigation><div className="student-portal-shell academy-grid min-h-screen"><div className="flex min-h-screen"><Sidebar variant="student"/><div className="min-w-0 flex-1"><StudentNavigation studentName="Fixture" onLogout={()=>{}}/><main className="student-play-area mx-auto w-full max-w-7xl px-4 pb-28 pt-6 md:pb-6 lg:px-6"><StudentMenuPage><Page/></StudentMenuPage></main></div></div></div></StudentMenuNavigation>);
