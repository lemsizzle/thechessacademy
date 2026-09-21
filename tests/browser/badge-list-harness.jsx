import { createRoot } from 'react-dom/client';
import { BadgeList } from '../../components/BadgeList';
import { allBadges } from '../../data/badges';
import { gameAchievements, achievementBadge } from '../../lib/badges/gameAchievements/catalog';
import { survivalAdamantiumBadge } from '../../lib/badges/survivalAdamantium';
const storeBadge = {...survivalAdamantiumBadge, id:'store-preview', name:'Vagabond Champion', tier:'Gold', category:'Creativity', unlockRequirement:'Buy the cardboard shirt (You Will Be Poor After This Purchase) and Cardboard Crown in the Avatar Store.'};
createRoot(document.getElementById('root')).render(<><h1 className="mb-2 text-3xl font-bold text-white">Badges</h1><p className="mb-6 text-slate-300">Select a badge name to see its artwork. Local sample catalog.</p><BadgeList badges={[survivalAdamantiumBadge, storeBadge, ...allBadges, ...gameAchievements.map(achievementBadge)]} /></>);
