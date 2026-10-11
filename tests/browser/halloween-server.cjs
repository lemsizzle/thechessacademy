// Local QA only: real application handlers + isolated PostgreSQL. No real students.
const http=require('node:http');
const {createHmac,randomUUID}=require('node:crypto');
const port=Number(process.env.HALLOWEEN_PREVIEW_PORT||3109), dbPort=port+1;
const origin=`http://127.0.0.1:${port}`;
const secret='halloween-isolated-verification-secret';
Object.assign(process.env,{NODE_ENV:'production',STUDENT_SESSION_SECRET:secret,SUPABASE_SERVICE_ROLE_KEY:'local-only-fixture-key',NEXT_PUBLIC_APP_URL:origin});
const studentId='20000000-0000-4000-8000-000000000002';
const student={id:studentId,display_name:'Puzzle Explorer',public_slug:'puzzle-explorer',class_group:'Chess Quest',total_xp:0,level:1,is_active:true,lichess_id:null,lichess_username:null};
function json(res,data,status=200,headers={}) {res.writeHead(status,{'Content-Type':'application/json',...headers});res.end(JSON.stringify(data));}
function filtered(rows,params) {
  for(const [field,value] of params) {
    const [op,...parts]=value.split('.'),target=parts.join('.');
    if(op==='eq') rows=rows.filter(row=>String(row[field])===target);
    if(op==='in') rows=rows.filter(row=>target.slice(1,-1).split(',').includes(String(row[field])));
    const scalar=row=>row[field] instanceof Date?row[field].toISOString():String(row[field]);
    if(op==='gte') rows=rows.filter(row=>scalar(row)>=target);
    if(op==='lte') rows=rows.filter(row=>scalar(row)<=target);
  }
  return rows;
}
(async()=>{
  const {createHalloweenTestDatabase}=await import('../fixtures/halloween-db.mjs');
  const pg=await createHalloweenTestDatabase();
  await pg.query('insert into students(id) values($1)',[studentId]);
  await pg.exec(`alter table internal_chess_games add column game_mode text,add column opponent_name text,add column player_color text,add column result_reason text,add column winner_color text,add column time_control jsonb,add column final_fen text,add column pgn text;`);
  const readable=new Set(['internal_chess_games','academy_quests','student_quest_attempts','lichess_quest_progress','quest_completion_events','xp_events','student_wallets','activity_events']);
  const db=http.createServer(async(req,res)=>{
    try {
      const url=new URL(req.url,origin),table=url.pathname.split('/').pop();
      if(url.pathname.includes('/rpc/')) {
        let body='';for await(const chunk of req)body+=chunk;
        const args=JSON.parse(body||'{}');
        if(table==='halloween_2026_progress') return json(res,(await pg.query('select halloween_2026_progress($1) p',[args.p_student_id])).rows[0].p);
        return json(res,[]);
      }
      if(req.method==='POST'&&table==='internal_chess_games') {
        let body='';for await(const chunk of req)body+=chunk;
        const row=JSON.parse(body);const keys=Object.keys(row);
        if(keys.some(key=>!/^[a-z_]+$/.test(key)))throw new Error('Invalid fixture column');
        const values=keys.map(key=>typeof row[key]==='object'&&row[key]!==null?JSON.stringify(row[key]):row[key]);
        const result=await pg.query(`insert into internal_chess_games(${keys.join(',')}) values(${keys.map((_,i)=>'$'+(i+1)).join(',')}) returning id`,values);
        return json(res,result.rows[0],201);
      }
      if(!['GET','HEAD'].includes(req.method))return json(res,{message:'Unrelated fixture write blocked'},403);
      let rows;
      if(table==='students') rows=[{...student,...(await pg.query('select * from students where id=$1',[studentId])).rows[0]}];
      else if(table==='student_login_credentials')rows=[{student_id:studentId,username:'halloween_test'}];
      else if(table==='student_avatar')rows=[{student_id:studentId,equipped_items:{}}];
      else rows=readable.has(table)?(await pg.query(`select * from ${table}`)).rows:[];
      rows=filtered(rows,url.searchParams);
      return json(res,(req.headers.accept||'').includes('vnd.pgrst.object')?rows[0]??null:rows,200,{'content-range':`0-${Math.max(0,rows.length-1)}/${rows.length}`});
    } catch(error){console.error(error.message);json(res,{message:error.message},500);}
  });
  const nativeFetch=global.fetch;
  global.fetch=(input,init)=>{
    const url=new URL(typeof input==='string'?input:input.url??String(input));
    if(url.pathname.startsWith('/rest/v1/'))return nativeFetch(`http://127.0.0.1:${dbPort}${url.pathname}${url.search}`,init);
    if(!['localhost','127.0.0.1'].includes(url.hostname))throw new Error('External network blocked in QA');
    return nativeFetch(input,init);
  };
  db.listen(dbPort,'127.0.0.1',async()=>{
    const app=require('next')({dev:false,hostname:'127.0.0.1',port});await app.prepare();const handler=app.getRequestHandler();
    http.createServer(async(req,res)=>{
      const url=new URL(req.url,origin);
      if(url.pathname==='/__qa/login') {
        const session={id:randomUUID(),studentId,name:'Puzzle Explorer',role:'student',authProvider:'academy',academyUsername:'halloween_test',onboardingCompleted:true,createdAt:new Date().toISOString(),expiresAt:new Date(Date.now()+3600000).toISOString()};
        const payload=Buffer.from(JSON.stringify(session)).toString('base64url'),sig=createHmac('sha256',secret).update(payload).digest('base64url');
        res.writeHead(302,{'Set-Cookie':`quest_board_student_session=${payload}.${sig}; Path=/; HttpOnly; SameSite=Lax`,Location:url.searchParams.get('screen')==='halloween'?'/student/play#computer-game':'/student/play'});return res.end();
      }
      if(url.pathname==='/__qa/state')return json(res,{progress:(await pg.query('select halloween_2026_progress($1) p',[studentId])).rows[0].p,xp:(await pg.query('select * from xp_events')).rows,coins:(await pg.query('select * from student_wallets')).rows,games:(await pg.query('select id,opponent_id,result,takeback_count,hints_used from internal_chess_games')).rows});
      if(url.pathname.startsWith('/api/')&&!['/api/auth/session','/api/student/profile','/api/student/seasonal-quest','/api/student/chess-games','/api/student/celebrations','/api/quests','/api/quest-progress'].includes(url.pathname)) {
        if(url.pathname==='/api/student/online-play')return json(res,{state:{students:[],incoming:[],outgoing:[],activeGameId:null}});
        if(url.pathname==='/api/student/board-themes')return json(res,{studentId,ownedThemes:[]});
        if(url.pathname==='/api/student/avatar')return json(res,{items:[],avatar:{studentId,equippedItems:{}},inventory:[],ownedItemIds:[],wallet:{academyCoins:0}});
        return json(res,{ok:true,incoming:[],outgoing:[],activeGames:[],unreadCount:0,realtimeTopic:null,games:[],awards:[],events:[]});
      }
      return handler(req,res);
    }).listen(port,'127.0.0.1',()=>console.log(`Isolated Halloween preview ready: ${origin}/__qa/login`));
  });
})();
