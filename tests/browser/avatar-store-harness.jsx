// Real store and board appearance provider; purchases and balances are local mocks.
import { createRoot } from 'react-dom/client';
import { useEffect, useState } from 'react';
import { AvatarStudio } from '../../components/student/AvatarStudio';
import { BoardAppearanceProvider, useBoardAppearance } from '../../chess/appearance/BoardAppearanceProvider';
import { seedAvatarItems } from '../../lib/avatar/catalog';
import { PAPER_CHESS_SET_SLUG } from '../../chess/appearance/themes';

const items = [...seedAvatarItems, { ...seedAvatarItems.find(item => item.slug === 'pawn-cap'), id: 'paper-set', slug: PAPER_CHESS_SET_SLUG, name: 'Paper Chess Set', category: 'board_theme', price: 50 }];
const ownedItemIds = items.filter(item => item.unlockType === 'default').map(item => item.id);
let avatar = { studentId: 'store-fixture', equippedItems: Object.fromEntries(items.filter(item => ownedItemIds.includes(item.id)).map(item => [item.category, item.id])) };
let coins = 1000, purchases = 0, equips = 0;
let failEquip = new URLSearchParams(location.search).has('failEquip');
const payload = () => ({ items, inventory: [], ownedItemIds: [...ownedItemIds], wallet: { academyCoins: coins }, avatar });
const notify = () => window.dispatchEvent(new Event('store-fixture'));
window.fetch = async (url, options = {}) => {
  const path = String(url), body = options.body ? JSON.parse(options.body) : {};
  await new Promise(resolve => setTimeout(resolve, 100));
  if (path.includes('/board-themes')) return Response.json({ studentId: 'store-fixture', ownedThemes: ownedItemIds.includes('paper-set') ? ['paper'] : [] });
  if (path.endsWith('/avatar/purchase')) {
    const item = items.find(item => item.id === body.itemId);
    if (!ownedItemIds.includes(item.id)) { coins -= item.price; ownedItemIds.push(item.id); purchases++; }
    notify(); return Response.json(payload());
  }
  if (path.endsWith('/avatar') && options.method === 'PATCH') {
    if (failEquip) { failEquip = false; return Response.json({ error: 'Simulated connection failure' }, { status: 500 }); }
    avatar = { ...avatar, equippedItems: body.equippedItems }; equips++; notify();
  }
  return Response.json(payload());
};
function Measurements() {
  const [, render] = useState(0);
  const { appearance } = useBoardAppearance();
  useEffect(() => { const update = () => render(n => n + 1); window.addEventListener('store-fixture', update); return () => window.removeEventListener('store-fixture', update); }, []);
  return <aside aria-label="Store test measurements" className="my-4 text-xs">Purchases: {purchases} · equips: {equips} · coins: {coins} · board: {appearance.boardTheme} · pieces: {appearance.pieceTheme}</aside>;
}
createRoot(document.getElementById('root')).render(<BoardAppearanceProvider studentId="store-fixture"><header className="sticky top-0 z-30 h-16 bg-slate-950 p-4 font-bold">Avatar Store · local test</header><Measurements/><AvatarStudio/></BoardAppearanceProvider>);
