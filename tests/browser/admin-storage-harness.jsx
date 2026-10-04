import { createRoot } from 'react-dom/client';
import { useState } from 'react';
import { AdminPanel as ActualAdminPanel } from '../../components/admin/AdminPanel';
import { seedAvatarItems } from '../../lib/avatar/catalog';
import { AdminStorageNotice } from '../../components/admin/AdminStorageNotice';
// Isolated local fixture: simulate the production quota failure without filling storage.
Storage.prototype.setItem = function () { throw new DOMException('Fixture: full storage', 'QuotaExceededError'); };
window.fetch = async () => new Response(JSON.stringify({students:[],quests:[],badges:[],items:[],events:[],games:[],attempts:[],progress:[],transactions:[],summary:{total:0,wins:0,draws:0,losses:0,winRate:0},pagination:{page:1,totalPages:1,total:0}}), {headers:{'Content-Type':'application/json'}});
const AdminPanel = props => <ActualAdminPanel {...props} initialAvatarItems={seedAvatarItems}/>;
function Preview() {
  const [mode,setMode]=useState('classes');
  return <><h1 className="text-2xl text-white">Teacher pages · full-storage test</h1><nav className="flex gap-4 py-4">{['classes','students','badges','quests','xp'].map(m=><button className="text-cyan-200" key={m} onClick={()=>setMode(m)}>{m}</button>)}</nav><AdminStorageNotice/><AdminPanel key={mode} mode={mode}/></>;
}
createRoot(document.getElementById('root')).render(<Preview/>);
