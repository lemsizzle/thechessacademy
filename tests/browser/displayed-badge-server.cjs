// Local production-build QA only. All Supabase traffic goes to synthetic storage;
// no fixture routes or authentication shortcuts are added to the application.
const http = require('node:http');
const { createHmac } = require('node:crypto');
const port = Number(process.env.BADGE_PREVIEW_PORT || 3109);
const dbPort = port + 1;
const origin = `http://127.0.0.1:${port}`;
const secret = 'displayed-badge-isolated-verification-secret';
Object.assign(process.env, { NODE_ENV: 'production', STUDENT_SESSION_SECRET: secret, SUPABASE_SERVICE_ROLE_KEY: 'local-only-fixture-key', NEXT_PUBLIC_APP_URL: origin });
const studentId = '20000000-0000-4000-8000-000000000002';
const otherId = '20000000-0000-4000-8000-000000000003';
const badgeIds = [1,2,3,4,5].map(i => `30000000-0000-4000-8000-${String(i).padStart(12,'0')}`);
const badges = [
  { name: 'Survival Adamantium', category: 'Tactics', tier: 'SS', final_image_url: '/badges/survival-adamantium-v1.webp', unlock_requirement: 'Score 50 in any Survival mode.' },
  { name: 'Royal Family Fork', category: 'Gameplay', tier: null, final_image_url: '/badges/game-achievements/royal-family-fork.svg', unlock_requirement: 'Fork the king, queen, and rook with a knight in a completed game.' },
  { name: 'Pawn Mate', category: 'Gameplay', tier: null, final_image_url: '/badges/game-achievements/pawn-mate.svg', unlock_requirement: 'Deliver checkmate with a pawn.' },
  { name: 'Fork Finder Bronze', category: 'Tactics', tier: 'C', final_image_url: '/badges/game-achievements/royal-family-fork.svg', unlock_requirement: 'Solve 10 fork puzzles in Survival.' },
  { name: 'Fork Finder Gold', category: 'Tactics', tier: 'A', final_image_url: '/badges/game-achievements/royal-family-fork.svg', unlock_requirement: 'Solve 30 fork puzzles in Survival.' }
].map((badge,i) => ({ ...badge, id: badgeIds[i], description: badge.unlock_requirement, xp_value: 100, art_image_url: null, generation_status: 'selected' }));
const students = [studentId,otherId].map((id,i) => ({ id, display_name: i ? 'Quest Knight' : 'Puzzle Explorer', public_slug: i ? 'quest-knight' : 'puzzle-explorer', class_group: 'Chess Quest', total_xp: i ? 200 : 1000, level: 5, is_active: true, lichess_id: null, lichess_username: null }));
const initialEarned = [
  { student_id: studentId, badge_id: badgeIds[0], is_displayed: false },
  { student_id: studentId, badge_id: badgeIds[1], is_displayed: false },
  { student_id: studentId, badge_id: badgeIds[3], is_displayed: false },
  { student_id: studentId, badge_id: badgeIds[4], is_displayed: false },
  { student_id: otherId, badge_id: badgeIds[2], is_displayed: true }
];
let earned = initialEarned.map(row => ({...row}));
let failNext = false;
const writes = [];
function json(res, data, status=200, headers={}) { res.writeHead(status, { 'Content-Type': 'application/json', ...headers }); res.end(JSON.stringify(data)); }
function filtered(rows, params) {
  for (const [field,value] of params) {
    const [op,...parts] = value.split('.'); const target = parts.join('.');
    if (op === 'eq') rows = rows.filter(row => String(row[field]) === target);
    if (op === 'in') rows = rows.filter(row => target.slice(1,-1).split(',').includes(String(row[field])));
  }
  return rows;
}
const db = http.createServer(async (req,res) => {
  const url = new URL(req.url,origin); const table = url.pathname.split('/').pop();
  if (url.pathname.includes('/rpc/')) {
    let body = ''; for await (const chunk of req) body += chunk;
    const args = JSON.parse(body || '{}');
    if (table === 'set_student_displayed_badge') {
      if (failNext) { failNext = false; return json(res,{message:'Simulated storage outage',code:'XX001'},503); }
      if (args.p_badge_id !== null && !earned.some(row => row.student_id === args.p_student_id && row.badge_id === args.p_badge_id)) return json(res,{message:'Badge not earned by this student',code:'P0001'},400);
      earned = earned.map(row => row.student_id === args.p_student_id ? { ...row, is_displayed: row.badge_id === args.p_badge_id } : row);
      writes.push(args); return json(res,args.p_badge_id);
    }
    return json(res,[]);
  }
  if (!['GET','HEAD'].includes(req.method)) return json(res,{message:'Unrelated fixture write blocked'},403);
  const now = new Date().toISOString();
  let rows = table === 'students' ? students : table === 'badges' ? badges
    : table === 'student_badges' ? earned.map(row => ({ ...row, badges: badges.find(b => b.id === row.badge_id), awarded_at: now }))
    : table === 'student_login_credentials' ? [{ student_id: studentId, username: 'badge_test' }]
    : table === 'student_avatar' ? students.map(row => ({student_id:row.id,equipped_items:{}}))
    : table === 'student_wallets' ? [{student_id:studentId,academy_coins:500,total_coins_earned:500,total_coins_spent:0}]
    : table === 'xp_events' ? [{ id:'fixture-xp',student_id:studentId,amount:1000,source:'badge',created_at:now }]
    : [];
  rows = filtered(rows,url.searchParams);
  json(res,(req.headers.accept || '').includes('vnd.pgrst.object') ? rows[0] ?? null : rows,200,{'content-range':`0-${Math.max(0,rows.length-1)}/${rows.length}`});
});
const nativeFetch = global.fetch;
global.fetch = (input,init) => {
  const url = new URL(typeof input === 'string' ? input : input.url ?? String(input));
  if (url.pathname.startsWith('/rest/v1/')) return nativeFetch(`http://127.0.0.1:${dbPort}${url.pathname}${url.search}`,init);
  if (!['localhost','127.0.0.1'].includes(url.hostname)) throw new Error('External network access blocked by isolated QA');
  return nativeFetch(input,init);
};
db.listen(dbPort,'127.0.0.1',async () => {
  const app = require('next')({ dev:false,hostname:'127.0.0.1',port }); await app.prepare(); const handler = app.getRequestHandler();
  http.createServer((req,res) => {
    const url = new URL(req.url,origin);
    if (url.pathname === '/__qa/login') {
      const session = { id:crypto.randomUUID(),studentId,name:'Puzzle Explorer',role:'student',authProvider:'academy',academyUsername:'badge_test',onboardingCompleted:true,createdAt:new Date().toISOString(),expiresAt:new Date(Date.now()+3600000).toISOString() };
      const payload = Buffer.from(JSON.stringify(session)).toString('base64url'); const sig = createHmac('sha256',secret).update(payload).digest('base64url');
      res.writeHead(302,{ 'Set-Cookie':`quest_board_student_session=${payload}.${sig}; Path=/; HttpOnly; SameSite=Lax`,Location:'/student/badges' }); return res.end();
    }
    if (url.pathname === '/__qa/state') return json(res,{earned,writes,students,coins:500});
    if (url.pathname === '/__qa/reset') { earned=initialEarned.map(row=>({...row})); writes.length=0; failNext=false; return json(res,{ok:true}); }
    if (url.pathname === '/__qa/fail-next') { failNext = true; return json(res,{ok:true}); }
    if (url.pathname === '/__qa/empty') { earned = earned.filter(row => row.student_id !== studentId); return json(res,{ok:true}); }
    if (url.pathname.startsWith('/api/') && !['/api/auth/session','/api/student/displayed-badge','/api/student/profile'].includes(url.pathname)) {
      if (url.pathname === '/api/student/online-play') return json(res,{ state:{students:[],incoming:[],outgoing:[],activeGameId:null} });
      if (url.pathname === '/api/student/board-themes') return json(res,{studentId,ownedThemes:[]});
      if (url.pathname === '/api/student/avatar') return json(res,{items:[],avatar:{studentId,equippedItems:{}},inventory:[],ownedItemIds:[],wallet:{academyCoins:500}});
      return json(res,{ok:true,incoming:[],outgoing:[],activeGames:[],unreadCount:0,realtimeTopic:null,games:[],awards:[],celebrations:[],quests:[],events:[]});
    }
    return handler(req,res);
  }).listen(port,'127.0.0.1',() => console.log(`Isolated badge preview ready: ${origin}/__qa/login`));
});
