// Real collection and badge dialog; isolated earned examples, no production writes.
import { createRoot } from 'react-dom/client';
import { GameAchievementCollection } from '../../components/GameAchievementCollection';
import { gameAchievements } from '../../lib/badges/gameAchievements/catalog';
const awards=gameAchievements.slice(0,2).map(a=>({badge_id:a.id,awarded_at:'2026-09-21T00:00:00Z',achievement_evidence:{sourceId:'lichess:heNcmap1',ply:39,completedAt:'2026-09-21T00:00:00Z'}}));
createRoot(document.getElementById('root')).render(<><p className="mb-4 text-sm text-amber-200">Local preview · two example earned badges · no account changes</p><GameAchievementCollection awards={awards} launchedAt="2026-09-21T00:00:00Z" /></>);
