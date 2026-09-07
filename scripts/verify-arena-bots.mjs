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
    add column game_mode text not null default 'live',add column days_per_move integer,add column turn_deadline_at timestamptz,
    add column rematch_requested_by uuid;
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
  await db.exec(sqlFile("20260907173735_internal_arena_bot_pairs"));
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
  const { id: robotArena } = await one(`insert into internal_arena_tournaments(name,status,starts_at,ends_at,duration_minutes,time_control_id,time_control,rated,class_group)
    values('Robots','active',now(),now()+interval '1 hour',60,'10m','{"id":"10m","name":"10 min","initialMs":600000,"incrementMs":0}',true,'A') returning id`);
  const robot = async (name, difficulty) => (await one("select manage_internal_arena_bot($1,'add',null,$2,$3) id",[robotArena,name,difficulty])).id;
  const robotPair = async (first=null,second=null) => (await one("select match_internal_arena_bot_pair($1,$2,$3,$4,$5) result",[robotArena,String(code++),fen,first,second])).result;
  const retire = (id) => db.query("select manage_internal_arena_bot($1,'remove',$2)",[robotArena,id]);
  const finish = async (id,winner=null) => {
    await db.query("update live_chess_games set status='completed',completed_at=now(),result_reason='timeout',winner_color=$2 where id=$1",[id,winner]);
    await db.query("select finalize_internal_arena_game($1)",[id]);
    await db.query("select finalize_internal_arena_game($1)",[id]);
  };
  const alpha = await robot("Alpha","queen"), beta = await robot("Beta","rook"), gamma = await robot("Gamma","bishop");
  // A real eligible waiting student has priority, even while playing correspondence elsewhere.
  await db.query("insert into internal_arena_entries(tournament_id,student_id,status) values($1,$2,'waiting')",[robotArena,second]);
  const { id: correspondenceGame } = await one(`insert into live_chess_games(challenge_code,created_by,white_player_id,black_player_id,status,time_control_id,time_control,initial_fen,current_fen,started_at,game_mode)
    values($1,$2,$2,$3,'active','10m','{"id":"10m","initialMs":600000,"incrementMs":0}',$4,$4,now(),'correspondence') returning id`,[String(code++),second,otherClass,fen]);
  assert.equal((await robotPair()).status,"waiting");
  // Force can choose two bots, but concurrent/reversed requests create one game only.
  const forced = await Promise.all([robotPair(alpha,beta),robotPair(beta,alpha)]);
  assert.equal(forced[0].gameId,forced[1].gameId);
  const robotGame = await one("select * from live_chess_games where id=$1",[forced[0].gameId]);
  assert.equal(robotGame.created_by,null); assert.equal(robotGame.white_player_id,null); assert.equal(robotGame.black_player_id,null);
  assert.equal(robotGame.rated,false); assert.equal(robotGame.arena_bot.color,"white"); assert.equal(robotGame.arena_opponent_bot.color,"black");
  assert.deepEqual([robotGame.arena_bot.id,robotGame.arena_opponent_bot.id].sort(),[alpha,beta].sort());
  assert.deepEqual([robotGame.arena_bot.difficultyId,robotGame.arena_opponent_bot.difficultyId].sort(),["queen","rook"]);
  assert.equal((await one("select count(*)::int n from internal_arena_pairings where tournament_id=$1",[robotArena])).n,1);
  await assert.rejects(robotPair(alpha,alpha), /different bots/);
  await assert.rejects(robotPair(alpha,null), /two Arena bots/);
  await assert.rejects(robotPair(gamma,bot), /not found/);
  await assert.rejects(robotPair(alpha,gamma), /available/);
  for (const color of ["white","black"]) {
    await db.query("update live_chess_games set active_color=$2,bot_lease_until=null where id=$1",[robotGame.id,color]);
    const claims=await Promise.all([db.query("select * from claim_internal_arena_bot_turn($1)",[robotGame.id]),db.query("select * from claim_internal_arena_bot_turn($1)",[robotGame.id])]);
    assert.equal(claims.reduce((n,r)=>n+r.rows.length,0),1);
  }
  for (const patch of [JSON.stringify({...robotGame.arena_opponent_bot,color:"white"}),JSON.stringify({...robotGame.arena_opponent_bot,id:robotGame.arena_bot.id}),JSON.stringify({id:beta,color:"black",name:"Missing skill"})]) {
    await assert.rejects(db.query("update live_chess_games set arena_opponent_bot=$2::jsonb where id=$1",[robotGame.id,patch]), /bot_shape/);
  }
  await assert.rejects(db.query("update live_chess_games set created_by=null where id=$1",[human.gameId]), /creator_required/);
  await db.query("select manage_internal_arena_bot($1,'update',$2,'Alpha','pawny')",[robotArena,alpha]);
  assert.equal((robotGame.arena_bot.id===alpha?robotGame.arena_bot:robotGame.arena_opponent_bot).difficultyId,"queen");
  // Removing a playing bot is idempotent, preserves its game and prevents requeue after completion.
  await Promise.all([retire(alpha),retire(alpha)]);
  assert.equal((await one("select status,current_game_id from internal_arena_entries where bot_id=$1",[alpha])).current_game_id,robotGame.id);
  await assert.rejects(db.query("select manage_internal_arena_bot($1,'update',$2,'Alpha','queen')",[robotArena,alpha]), /removed/);
  await finish(robotGame.id,"white");
  for (const [snapshot,points] of [[robotGame.arena_bot,2],[robotGame.arena_opponent_bot,0]]) {
    const entry=await one("select score,games_played,status,current_game_id from internal_arena_entries where bot_id=$1",[snapshot.id]);
    assert.equal(entry.score,points); assert.equal(entry.games_played,1); assert.equal(entry.current_game_id,null);
    assert.equal(entry.status,snapshot.id===alpha?"withdrawn":"waiting");
  }
  await assert.rejects(robotPair(alpha,gamma), /available/);
  // Bots left over pair automatically once the eligible human leaves the queue.
  await db.query("update internal_arena_entries set status='withdrawn' where tournament_id=$1 and student_id=$2",[robotArena,second]);
  const auto=await robotPair(); assert.equal(auto.status,"matched");
  assert.equal((await robotPair()).status,"waiting");
  await finish(auto.gameId);
  assert.equal((await one("select score,games_played from internal_arena_entries where bot_id=$1",[gamma])).score,1);
  // Idle withdrawal is immediate and repeat-safe.
  await retire(gamma); await retire(gamma);
  assert.equal((await one("select status from internal_arena_entries where bot_id=$1",[gamma])).status,"withdrawn");
  assert.equal((await robotPair()).status,"waiting");
  // Human-vs-bot withdrawal preserves the human result and never brings the bot back.
  await db.query("update internal_arena_entries set status='waiting' where tournament_id=$1 and student_id=$2",[robotArena,second]);
  const mixed=(await one("select match_internal_arena_bot($1,$2,$3,$4,$5) result",[robotArena,second,String(code++),fen,beta])).result;
  await retire(beta);
  const mixedGame=await one("select arena_bot from live_chess_games where id=$1",[mixed.gameId]);
  await finish(mixed.gameId,mixedGame.arena_bot.color==='white'?'black':'white');
  assert.equal((await one("select status from internal_arena_entries where bot_id=$1",[beta])).status,"withdrawn");
  assert.equal((await one("select score,games_played from internal_arena_entries where tournament_id=$1 and student_id=$2",[robotArena,second])).score,2);
  assert.equal((await one("select status from live_chess_games where id=$1",[correspondenceGame])).status,"active");
  const delta=await robot("Delta","pawny"), epsilon=await robot("Epsilon","so-pawny");
  const last=await robotPair(delta,epsilon);
  await db.query("update internal_arena_tournaments set status='finished' where id=$1",[robotArena]);
  await finish(last.gameId,"black");
  assert.equal((await one("select status from internal_arena_entries where bot_id=$1",[delta])).status,"finished");
  await assert.rejects(robotPair(), /not accepting/);
  for (const fn of ["match_internal_arena_bot_pair(uuid,text,text,uuid,uuid)","claim_internal_arena_bot_turn(uuid)","finalize_internal_arena_game(uuid)","manage_internal_arena_bot(uuid,text,uuid,text,text)"]) {
    const privileges=await one("select has_function_privilege('anon',$1,'execute') a,has_function_privilege('authenticated',$1,'execute') b,has_function_privilege('service_role',$1,'execute') s",[fn]);
    assert.deepEqual(privileges,{a:false,b:false,s:true});
  }
  console.log("PASS: Arena migrations, human/bot/bot pairing, priority, concurrency, alternating leases, scoring, removal during play, idempotency, skill snapshots, shape constraints and service-only privileges.");
} catch (error) {
  console.error(error.message, error.detail ?? "", error.where ?? "", error.code ?? "");
  process.exitCode = 1;
} finally { await db.close(); }
