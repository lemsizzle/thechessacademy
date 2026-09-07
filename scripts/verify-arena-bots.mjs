// Disposable PostgreSQL/WASM verification. Never connects to production.
// node scripts/verify-arena-bots.mjs <path-to-installed-@electric-sql/pglite>
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { PGlite } = require(process.argv[2] || "@electric-sql/pglite");
const db = new PGlite();
const sqlFile = (name) => readFileSync(`supabase/migrations/${name}.sql`, "utf8");
const one = async (sql, params = []) => (await db.query(sql, params)).rows[0];
const student = "11111111-1111-4111-8111-111111111111";
const second = "22222222-2222-4222-8222-222222222222";
const otherClass = "33333333-3333-4333-8333-333333333333";
const fen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
let code = 1000;
try {
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create schema realtime; create function realtime.send(jsonb,text,text,boolean) returns void language sql as 'select';
    create table students(id uuid primary key,display_name text,class_group text,is_active boolean default true);
    create table internal_chess_games(id uuid primary key,player_id uuid references students,opponent_type text);
    insert into students values ('${student}','One','A',true),('${second}','Two','A',true),('${otherClass}','Other','B',true);`);
  await db.exec(sqlFile("20260821140030_create_live_student_games"));
  await db.exec(`alter table live_chess_games add column rated boolean default false, add column matchmaking boolean default false,
    add column game_mode text not null default 'live',add column days_per_move integer,add column turn_deadline_at timestamptz;
    alter table live_chess_games drop constraint live_chess_games_code_format;
    alter table live_chess_games add constraint live_chess_games_code_format check(challenge_code ~ '^[A-Z0-9]{4}$');`);
  await db.exec(sqlFile("20260826011541_create_internal_arena_tournaments"));
  const correspondence = sqlFile("20260829100650_add_student_correspondence_challenges");
  for (const name of ["match_internal_arena_student", "force_internal_arena_pair"]) {
    const start = correspondence.indexOf(`create or replace function public.${name}(`);
    const end = correspondence.indexOf("\n$$;", start) + 4;
    assert.ok(start >= 0 && end > start); await db.exec(correspondence.slice(start, end));
  }
  await db.exec(sqlFile("20260907012638_internal_arena_bots"));
  const { id: arena } = await one(`insert into internal_arena_tournaments(name,status,starts_at,ends_at,duration_minutes,time_control_id,time_control,rated,class_group)
    values('Fixture','active',now(),now()+interval '1 hour',60,'10m','{"id":"10m","name":"10 min","initialMs":600000,"incrementMs":0}',true,'A') returning id`);
  await db.query("insert into internal_arena_entries(tournament_id,student_id,status) values($1,$2,'waiting'),($1,$3,'waiting'),($1,$4,'waiting')", [arena, student, second, otherClass]);
  const add = async (name = "Zippy", difficulty = "knight") => (await one("select manage_internal_arena_bot($1,'add',null,$2,$3) id", [arena, name, difficulty])).id;
  const pair = async (sid, bot = null) => (await one("select match_internal_arena_bot($1,$2,$3,$4,$5) result", [arena,sid,String(code++),fen,bot])).result;
  const bot = await add();
  await assert.rejects(add("Bad","not-a-level"), /valid bot/);
  await assert.rejects(pair(otherClass, bot), /eligible/);
  const human = (await one("select match_internal_arena_student($1,$2,$3,$4,null) result", [arena, student, String(code++), fen])).result;
  assert.equal(human.status,"matched");
  assert.equal((await one("select rated from live_chess_games where id=$1",[human.gameId])).rated,true);
  await db.query("update live_chess_games set status='completed',completed_at=now(),result_reason='draw' where id=$1", [human.gameId]);
  await db.query("select finalize_internal_arena_game($1)",[human.gameId]);
  const [a,b] = await Promise.all([pair(student,bot),pair(student,bot)]);
  assert.equal(a.gameId,b.gameId);
  const game = await one("select * from live_chess_games where id=$1",[a.gameId]);
  assert.equal(game.rated,false);
  assert.equal(game.arena_bot.difficultyId,"knight");
  assert.ok(game.white_player_id === student || game.black_player_id === student);
  assert.equal([game.white_player_id,game.black_player_id].filter(Boolean).length,1);
  await assert.rejects(pair(second,bot), /not available/);
  await assert.rejects(db.query("select manage_internal_arena_bot($1,'remove',$2)",[arena,bot]), /finish its current game/);
  await db.query("select manage_internal_arena_bot($1,'update',$2,'Zippy','queen')",[arena,bot]);
  assert.equal((await one("select arena_bot from live_chess_games where id=$1",[game.id])).arena_bot.difficultyId,"knight");
  await db.query("update live_chess_games set active_color=arena_bot->>'color' where id=$1",[game.id]);
  const leases = await Promise.all([db.query("select * from claim_internal_arena_bot_turn($1)",[game.id]),db.query("select * from claim_internal_arena_bot_turn($1)",[game.id])]);
  assert.equal(leases.reduce((sum,result)=>sum+result.rows.length,0),1);
  await db.query("update live_chess_games set bot_lease_until=now()-interval '1 second' where id=$1",[game.id]);
  assert.equal((await db.query("select * from claim_internal_arena_bot_turn($1)",[game.id])).rows.length,1);
  await db.query("update live_chess_games set status='completed',completed_at=now(),result_reason='resignation',winner_color=$2 where id=$1",[game.id,game.arena_bot.color==='white'?'black':'white']);
  await db.query("select finalize_internal_arena_game($1)",[game.id]);
  await db.query("select finalize_internal_arena_game($1)",[game.id]);
  const scores = (await db.query("select student_id,bot_id,score,games_played,status from internal_arena_entries where tournament_id=$1",[arena])).rows;
  assert.equal(scores.find(r=>r.student_id===student).score,3);
  assert.equal(scores.find(r=>r.bot_id===bot).games_played,1);
  assert.equal(scores.find(r=>r.bot_id===bot).status,"waiting");
  const next = await pair(student,bot);
  assert.equal((await one("select arena_bot from live_chess_games where id=$1",[next.gameId])).arena_bot.difficultyId,"queen");
  await db.query("update internal_arena_tournaments set status='finished' where id=$1",[arena]);
  await db.query("update live_chess_games set status='completed',completed_at=now(),result_reason='timeout',winner_color=arena_bot->>'color' where id=$1",[next.gameId]);
  await db.query("select finalize_internal_arena_game($1)",[next.gameId]);
  assert.equal((await one("select status,score from internal_arena_entries where bot_id=$1",[bot])).status,"finished");
  await assert.rejects(pair(second,bot), /not accepting/);
  await assert.rejects(add(), /no longer accepting/);
  await db.query("update internal_arena_tournaments set status='active' where id=$1",[arena]);
  await db.query("select manage_internal_arena_bot($1,'remove',$2)",[arena,bot]);
  for(let i=0;i<12;i++) await add(`Bot ${i}`);
  await assert.rejects(add(), /at most 12/);
  const security = await one(`select relrowsecurity rls,has_table_privilege('anon','internal_arena_bots','select') anon,
    has_table_privilege('authenticated','internal_arena_bots','insert') browser_write,
    has_function_privilege('anon','manage_internal_arena_bot(uuid,text,uuid,text,text)','execute') public_rpc,
    has_function_privilege('service_role','manage_internal_arena_bot(uuid,text,uuid,text,text)','execute') server_rpc
    from pg_class where oid='internal_arena_bots'::regclass`);
  assert.deepEqual(security,{rls:true,anon:false,browser_write:false,public_rpc:false,server_rpc:true});
  console.log("PASS: Arena bot migrations, caps, class eligibility, human pairing, exactly-once pairing/score, leases/recovery, skill snapshots, no PvP rating, removal/end rules and RLS/grants.");
} finally { await db.close(); }
