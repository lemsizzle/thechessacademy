// Deterministic, lightweight vector medal artwork and seed data. No runtime image calls.
import { mkdirSync,writeFileSync,readFileSync } from 'node:fs';
import { gameAchievements } from '../lib/badges/gameAchievements/catalog.ts';
const out='public/badges/game-achievements';
mkdirSync(out,{recursive:true});
const esc=s=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
const colors={Learning:['#67e8f9','#075985'],Structures:['#a7f3d0','#065f46'],Checkmates:['#fde68a','#92400e'],Surprises:['#ddd6fe','#5b21b6'],'Opening Curiosities':['#f9a8d4','#9d174d'],'Clock Adventures':['#fdba74','#9a3412'],'Match Streaks':['#fef08a','#854d0e']};
for(const [index,a] of gameAchievements.entries()) {
  const [light,dark]=colors[a.group];
  const symbol=a.key.includes('knight')||a.key.includes('fork')?'knight':a.group==='Clock Adventures'?'clock':a.group==='Structures'?'pattern':a.group==='Opening Curiosities'?'book':a.group==='Match Streaks'?'star':'crown';
  const icons={
    crown:'<path d="M70 103l19 58h78l19-58-32 23-26-47-26 47z"/><path d="M88 172h80"/>',
    knight:'<path d="M91 174h77l-5-20-10-9c23-25 13-63-15-65l-5-15-14 22-31 36 18 15 22-19-4 29z"/><circle cx="139" cy="105" r="4" fill="#111827" stroke="none"/>',
    clock:'<circle cx="128" cy="128" r="46"/><path d="M128 94v34l24 15M115 68h26M128 68v14"/>',
    pattern:'<path d="M128 81l46 47-46 47-46-47z" fill="none"/>'+[[128,81],[174,128],[128,175],[82,128]].map(([x,y])=>`<circle cx="${x}" cy="${y}" r="12"/>`).join(''),
    book:'<path d="M79 91q24-12 49 5 25-17 49-5v73q-25-12-49 5-25-17-49-5z"/><path d="M128 97v69M94 112l18 4M144 116l18-4M94 132l18 4M144 136l18-4"/>',
    star:'<path d="M128 76l16 32 36 5-26 25 6 36-32-17-32 17 6-36-26-25 36-5z"/>'
  };
  const marks=Array.from({length:a.xp===100?3:a.xp===50?2:1},(_,i)=>`<circle cx="${128+(i-(a.xp===100?1:a.xp===50?.5:0))*16}" cy="200" r="4" fill="${light}"/>`).join('');
  writeFileSync(`${out}/${a.key}.svg`,`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" role="img"><title>${esc(a.name)}</title><defs><radialGradient id="bg"><stop stop-color="${dark}"/><stop offset="1" stop-color="#0f172a"/></radialGradient><linearGradient id="rim" x2="1" y2="1"><stop stop-color="#fff6cc"/><stop offset=".48" stop-color="#b77926"/><stop offset=".74" stop-color="#ffe5a0"/><stop offset="1" stop-color="#744c1a"/></linearGradient></defs><circle cx="128" cy="128" r="124" fill="url(#rim)"/><circle cx="128" cy="128" r="114" fill="url(#bg)" stroke="${light}" stroke-width="2"/><circle cx="128" cy="128" r="104" fill="none" stroke="${light}" opacity=".3" stroke-dasharray="2 8"/><path d="M58 156q-18-28 0-66M198 156q18-28 0-66" fill="none" stroke="#d4a54c" stroke-width="5"/><g fill="${light}" stroke="${light}" stroke-width="6" stroke-linecap="round" stroke-linejoin="round">${icons[symbol]}</g>${marks}<text x="128" y="50" text-anchor="middle" font-family="Georgia,serif" font-size="11" letter-spacing="3" fill="#ffe8ae">CHESS QUEST</text><text x="128" y="226" text-anchor="middle" font-family="sans-serif" font-size="10" letter-spacing="2" fill="${light}">NO. ${String(index+1).padStart(2,'0')}</text></svg>`);
}
const sql=s=>"'"+String(s).replaceAll("'","''")+"'";
const migration='supabase/migrations/20260920181926_game_achievement_badges.sql';
const base=readFileSync(migration,'utf8').split('-- BEGIN GENERATED CATALOG')[0];
writeFileSync(migration,base+'-- BEGIN GENERATED CATALOG\n'+gameAchievements.map(a=>`insert into public.badges(id,name,description,category,tier,xp_value,unlock_requirement,visual_theme,art_image_url,generation_status) values(${[a.id,a.name,`Game achievement · ${a.group}`,'Creativity',a.xp===100?'A':a.xp===50?'B':'C',a.xp,a.requirement,'Chess Quest game achievement',`/badges/game-achievements/${a.key}.svg`,'selected'].map(sql).join(',')}) on conflict(id) do nothing;\ninsert into public.game_achievement_rules(key,badge_id) values(${sql(a.key)},${sql(a.id)}) on conflict do nothing;`).join('\n')+'\n');
console.log(`Generated ${gameAchievements.length} medals and badge rules.`);
