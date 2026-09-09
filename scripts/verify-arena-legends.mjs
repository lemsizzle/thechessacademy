import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {PGlite}=require(process.argv[2] || '@electric-sql/pglite');
const db=new PGlite();
const sql=readFileSync('scripts/arena-legends-badges.sql','utf8');
const one=async(q,p=[]) => (await db.query(q,p)).rows[0];
try {
 await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
 create table students(id uuid primary key default gen_random_uuid());
 create table badges(id uuid primary key,name text,description text,category text,tier text,xp_value int,unlock_requirement text,visual_theme text,generation_status text);
 create table student_badges(id uuid primary key default gen_random_uuid(),student_id uuid references students,badge_id uuid references badges,note text,unique(student_id,badge_id));
 create table activity_events(student_id uuid,event_type text,title text,description text);
 create table internal_arena_tournaments(id uuid primary key default gen_random_uuid(),status text,experience_version int);
 create table internal_arena_results(tournament_id uuid primary key references internal_arena_tournaments,standings jsonb,settled_at timestamptz default now());`);
 const ids=[];for(let i=0;i<5;i++)ids.push((await one('insert into students default values returning id')).id);
 const result=async(places,status='finished',version=1)=>{
  const t=(await one('insert into internal_arena_tournaments(status,experience_version) values($1,$2) returning id',[status,version])).id;
  await db.query('insert into internal_arena_results(tournament_id,standings) values($1,$2)',[t,JSON.stringify(places.map(([i,rank,games=1])=>({studentId:ids[i],rank,gamesPlayed:games})))]);
  return t;
 };
 // One pre-existing recorded tournament, then the migration backfill.
 await result([[0,1],[1,2],[2,3],[3,4],[4,1,0]]);
 await db.exec(sql);await db.exec(sql);
 const tiers=async(i)=>(await db.query('select b.tier from student_badges sb join badges b on b.id=sb.badge_id where student_id=$1 order by b.tier',[ids[i]])).rows.map(r=>r.tier);
 assert.deepEqual(await tiers(0),['A']);assert.deepEqual(await tiers(1),['B']);assert.deepEqual(await tiers(2),['C']);
 assert.deepEqual(await tiers(3),[]);assert.deepEqual(await tiers(4),[]);
 assert.equal((await one('select count(*)::int n from activity_events')).n,3);
 await result([[0,1]],'cancelled');await result([[0,1]],'active');await result([[0,1]],'finished',0);
 for(let i=0;i<3;i++)await result([[0,1],[1,1],[2,3]]); // tied rank=1 counts as a win
 assert.deepEqual(await tiers(0),['A']);
 const fifth=await result([[0,1],[1,2]]);
 assert.deepEqual(await tiers(0),['A','S']);
 assert.deepEqual(await tiers(1),['A','B']);
 await db.query('select award_arena_legends($1)',[ids[0]]);await db.exec(sql);
 assert.equal((await one('select count(*)::int n from student_badges where student_id=$1',[ids[0]])).n,2);
 await assert.rejects(db.query('insert into internal_arena_results(tournament_id,standings) values($1,$2)',[fifth,'[]']),/duplicate key/);
 for(const role of ['anon','authenticated'])assert.equal((await one("select has_function_privilege($1,'award_arena_legends(uuid)','execute') allowed",[role])).allowed,false);
 assert.equal((await one('select sum(xp_value)::int n from badges')).n,0);
 console.log('PASS: exact podium tiers, past results, fifth distinct win, ties, zero games, cancelled/active/legacy exclusion, replay and role restrictions.');
} finally {await db.close();}
