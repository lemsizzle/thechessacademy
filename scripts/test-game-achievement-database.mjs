// Run against isolated PGlite. Never connects to production or changes students.
// Install with: npm install --prefix work/achievement-db-test --no-save @electric-sql/pglite@0.5.8
import { PGlite } from '../work/achievement-db-test/node_modules/@electric-sql/pglite/dist/index.js';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
const engine = await build({entryPoints:['lib/badges/gameAchievements/detect.ts'],bundle:true,write:false,format:'esm',platform:'node'});
const { detectGameAchievements } = await import('data:text/javascript;base64,'+Buffer.from(engine.outputFiles[0].contents).toString('base64'));
const db=new PGlite();
await db.exec(`
create role anon;create role authenticated;create role service_role;
create table students(id uuid primary key, total_xp integer default 0);
create table badges(id uuid primary key,name text,description text,category text,tier text,xp_value integer,unlock_requirement text,visual_theme text,art_image_url text,generation_status text);
create table student_badges(id uuid primary key default gen_random_uuid(),student_id uuid references students(id),badge_id uuid references badges(id),note text,awarded_at timestamptz default now(),unique(student_id,badge_id));
create table xp_events(id uuid primary key default gen_random_uuid(),student_id uuid,amount integer,reason text);
create table activity_events(student_id uuid,event_type text,title text,description text);
create table wallets(student_id uuid primary key,coins integer default 0);
create function coins_from_xp() returns trigger language plpgsql as $$ begin insert into public.wallets values(new.student_id,new.amount) on conflict(student_id) do update set coins=wallets.coins+new.amount;return new;end $$;
create trigger award_academy_coins_after_xp_event after insert on xp_events for each row execute function coins_from_xp();
create table internal_chess_games(id uuid primary key,player_id uuid,result text,opponent_type text,opponent_id text,initial_fen text,moves jsonb,takeback_count integer,started_at timestamptz,completed_at timestamptz);
`);
await db.exec(readFileSync('supabase/migrations/20260920181926_game_achievement_badges.sql','utf8'));
const student='00000000-0000-4000-8000-000000000001';
await db.query('insert into students(id) values($1)',[student]);
const start='rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const gameId=n=>`00000000-0000-4000-8000-${String(n+100).padStart(12,'0')}`;
async function game(n,{old=false,takebacks=0,won=true,opponent='same'}={}) {
  await db.query(`insert into internal_chess_games values($1,$2,$3,'student',$4,$5,'[{"from":"e2","to":"e4"}]',$6,now()+($7||' seconds')::interval,now()+($8||' seconds')::interval)`,[gameId(n),student,won?'win':'loss',opponent,start,takebacks,old?-1000:n,n+1]);
}
const complete=(n,hits=[])=>db.query('select complete_game_achievement_scan($1,$2,$3) as awards',[student,`academy:${gameId(n)}`,JSON.stringify(hits)]);
await game(1,{old:true});await game(2,{takebacks:1});
assert.equal((await db.query('select count(*)::int as n from game_achievement_scans')).rows[0].n,0);
await game(3);
await assert.rejects(complete(3,[{key:'first-fork',ply:3},{key:'nonexistent',ply:3}]));
assert.equal((await db.query('select count(*)::int as n from student_badges')).rows[0].n,0);
assert.equal((await db.query('select total_xp from students')).rows[0].total_xp,0);
assert.equal((await complete(3,[{key:'first-fork',ply:3,fen:'fixture'},{key:'first-fork',ply:3}])).rows[0].awards,1);
assert.equal((await complete(3,[{key:'first-fork',ply:3}])).rows[0].awards,0);
await game(4);await complete(4,[{key:'first-fork',ply:3}]);
assert.equal((await db.query('select total_xp from students')).rows[0].total_xp,25);
assert.equal((await db.query('select coins from wallets')).rows[0].coins,25);
for(let n=5;n<=12;n++){await game(n);await complete(n);}
assert.equal((await db.query("select count(*)::int as n from student_badges s join game_achievement_rules r on r.badge_id=s.badge_id where r.key='adoption'")).rows[0].n,1);
await game(13,{won:false});await complete(13);
for(let n=14;n<=32;n++){await game(n);await complete(n);}
assert.equal((await db.query("select count(*)::int as n from student_badges s join game_achievement_rules r on r.badge_id=s.badge_id where r.key='double-adoption'")).rows[0].n,0);
await game(33);await complete(33);
assert.equal((await db.query("select count(*)::int as n from student_badges s join game_achievement_rules r on r.badge_id=s.badge_id where r.key='double-adoption'")).rows[0].n,1);
assert.equal((await db.query('select total_xp from students')).rows[0].total_xp,225);
assert.equal((await db.query('select coins from wallets')).rows[0].coins,225);
// One full pipeline: legal moves -> detector -> persisted badge, evidence and rewards.
await game(34,{opponent:'new-opponent'});
const hits=detectGameAchievements({moves:'f3 e5 g4 Qh4#',color:'b',winner:'b',reason:'checkmate'});
assert.equal((await complete(34,hits)).rows[0].awards,1);
assert.equal((await db.query('select total_xp from students')).rows[0].total_xp,275);
assert.equal((await db.query('select coins from wallets')).rows[0].coins,275);
assert.equal((await db.query("select achievement_evidence->>'ply' as ply from student_badges s join game_achievement_rules r on s.badge_id=r.badge_id where r.key='mate-move-2'")).rows[0].ply,'4');
const second='00000000-0000-4000-8000-000000000002';
await db.query('insert into students(id) values($1)',[second]);
for(let n=1;n<=20;n++) {
  await db.query("insert into game_achievement_scans(student_id,source_id,started_at,completed_at,opponent_key,won) values($1,$2,now(),now()+($3||' seconds')::interval,'lichess:same',true)",[second,`lichess:${n}`,n]);
  await db.query("select complete_game_achievement_scan($1,$2,'[]')",[second,`lichess:${n}`]);
}
assert.equal((await db.query('select count(*)::int as n from student_badges where student_id=$1',[second])).rows[0].n,0);
for(const role of ['anon','authenticated']) {
  assert.equal((await db.query("select has_function_privilege($1,'complete_game_achievement_scan(uuid,text,jsonb)','execute') as allowed",[role])).rows[0].allowed,false);
  assert.equal((await db.query("select has_table_privilege($1,'game_achievement_scans','select') as allowed",[role])).rows[0].allowed,false);
}
assert.equal((await db.query('select count(*)::int as n from game_achievement_rules')).rows[0].n,71);
console.log('Database PASS: legal-game detection to badge/XP/coins/evidence, 71 rules, release cutoff, takebacks, atomic rollback, duplicate/retry rewards, 10/20 Academy win streaks, loss reset, Lichess streak exclusion, private permissions.');
await db.close();
