// Isolated PostgreSQL test of the actual pairing functions; no production writes.
import { PGlite } from '../work/achievement-db-test/node_modules/@electric-sql/pglite/dist/index.js';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const db = new PGlite();
const read = path => readFileSync(path, 'utf8');
const fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const [arena, first, second, botA, botB] = [1,2,3,4,5].map(id);
await db.exec(`
create role anon; create role authenticated; create role service_role;
create table students(id uuid primary key, is_active boolean default true, class_group text);
create table internal_arena_tournaments(id uuid primary key,status text,starts_at timestamptz,ends_at timestamptz,class_group text,experience_version integer,time_control jsonb,time_control_id text,rated boolean);
create table internal_arena_entries(id uuid primary key default gen_random_uuid(),tournament_id uuid,student_id uuid,bot_id uuid,status text,current_game_id uuid,queue_entered_at timestamptz,updated_at timestamptz default now());
create table internal_arena_bots(id uuid primary key,tournament_id uuid,name text,difficulty_id text);
create table live_chess_games(id uuid primary key default gen_random_uuid(),challenge_code text,created_by uuid,white_player_id uuid,black_player_id uuid,status text,time_control_id text,time_control jsonb,initial_fen text,current_fen text,active_color text,white_ms bigint,black_ms bigint,clock_started_at timestamptz,started_at timestamptz,rated boolean,matchmaking boolean,arena_tournament_id uuid,arena_bot jsonb,arena_opponent_bot jsonb,game_mode text default 'live');
create table internal_arena_pairings(id uuid primary key default gen_random_uuid(),tournament_id uuid,game_id uuid,white_student_id uuid,black_student_id uuid,bot_id uuid,bot_color text,bot_name text,opponent_bot_id uuid,opponent_bot_name text,started_at timestamptz default now());
create function arena_student_ready(t uuid,s uuid) returns boolean language sql as $$select exists(select 1 from public.internal_arena_entries where tournament_id=t and student_id=s and status='waiting')$$;
insert into internal_arena_tournaments values('${arena}','active',now()-interval '1 minute',now()+interval '1 hour',null,1,'{"initialMs":600000}','10m',false);
insert into students(id) values('${first}'),('${second}');
insert into internal_arena_bots values('${botA}','${arena}','A','knight'),('${botB}','${arena}','B','knight');
`);
const old = read('supabase/migrations/20260908143115_academy_arena_experience.sql');
for (const name of ['force_internal_arena_pair','match_internal_arena_bot','match_internal_arena_bot_pair']) {
  await db.exec(old.match(new RegExp('CREATE OR REPLACE FUNCTION public\\.'+name+'\\([\\s\\S]*?\\$function\\$;'))[0]);
}
const helper = read('supabase/migrations/20260908020607_prevent_consecutive_arena_pairings.sql').match(/create or replace function public\.arena_entries_can_pair[\s\S]*?\$\$;/)[0];
await db.exec(helper);
async function seed(kind, experience = 1) {
  await db.exec(`truncate internal_arena_entries,internal_arena_pairings,live_chess_games;
  update internal_arena_tournaments set status='active',ends_at=now()+interval '1 hour',experience_version=${experience};`);
  const entries = kind==='human' ? [[first,null],[second,null]] : kind==='mixed' ? [[first,null],[null,botA]] : [[null,botA],[null,botB]];
  for(const [student,bot] of entries) await db.query("insert into internal_arena_entries(tournament_id,student_id,bot_id,status,queue_entered_at) values($1,$2,$3,'waiting',now()-interval '1 minute')",[arena,student,bot]);
  await db.query('insert into internal_arena_pairings(tournament_id,white_student_id,black_student_id,bot_id,opponent_bot_id,started_at) values($1,$2,$3,$4,$5,now()-interval \'1 minute\')', [arena,kind==='bots'?null:first,kind==='human'?second:null,kind==='human'?null:botA,kind==='bots'?botB:null]);
}
const human = () => db.query('select force_internal_arena_pair($1,$2,$3,$4,$5) as result',[arena,first,second,'ABCD',fen]);
const mixed = explicit => db.query('select match_internal_arena_bot($1,$2,$3,$4,$5) as result',[arena,first,'ABCD',fen,explicit?botA:null]);
const bots = explicit => db.query('select match_internal_arena_bot_pair($1,$2,$3,$4,$5) as result',[arena,'ABCD',fen,explicit?botA:null,explicit?botB:null]);
await seed('human');
await assert.rejects(human(),/consecutive opponents/);
await db.exec(read('supabase/migrations/20260928000100_allow_forced_arena_rematches.sql'));
assert.equal((await human()).rows[0].result.status,'matched');
await assert.rejects(human(),/available for pairing/);
await seed('human'); await db.exec("update internal_arena_tournaments set status='finished'");
await assert.rejects(human(),/not accepting new games/);
await seed('human'); await db.exec("update internal_arena_entries set status='withdrawn'");
await assert.rejects(human(),/available for pairing/);
await seed('mixed');
assert.equal((await mixed(false)).rows[0].result.status,'waiting');
assert.equal((await mixed(true)).rows[0].result.status,'matched');
await seed('bots',0);
assert.equal((await bots(false)).rows[0].result.status,'waiting');
assert.equal((await bots(true)).rows[0].result.status,'matched');
// Shared repeat-opponent helper remains strict for all automatic human matching.
await seed('human');
const pair = await db.query('select arena_entries_can_pair($1,(select id from internal_arena_entries where student_id=$2),(select id from internal_arena_entries where student_id=$3)) as allowed',[arena,first,second]);
assert.equal(pair.rows[0].allowed,false);
console.log('PASS: forced rematches for humans, mixed pairs and bots; automatic repeats blocked; busy/withdrawn/finished guards preserved.');
await db.close();

