// Disposable PostgreSQL/WASM verification. Never connects to production.
// node scripts/verify-arena-experience.mjs <path-to-installed-@electric-sql/pglite>
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
    create table students(id uuid primary key default gen_random_uuid(),display_name text,class_group text,is_active boolean default true);
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
  await db.exec(sqlFile("20260907180710_arena_bot_difficulty_slider"));

  await db.exec(sqlFile("20260908012941_arena_pause_and_berserk"));
  await db.exec(sqlFile("20260908020607_prevent_consecutive_arena_pairings"));
  await db.exec(`create table student_wallets(student_id uuid primary key references students,academy_coins int default 0,total_coins_earned int default 0,total_coins_spent int default 0);
    create table coin_transactions(id uuid primary key default gen_random_uuid(),student_id uuid references students,amount int,transaction_type text,source_type text,source_id text,description text,idempotency_key text unique);
    create table activity_events(id uuid primary key default gen_random_uuid(),student_id uuid references students,event_type text,title text,description text);`);
  await db.exec("CREATE OR REPLACE FUNCTION public.grant_academy_coins(p_student_id uuid, p_amount integer, p_transaction_type text, p_source_type text, p_source_id text, p_description text, p_idempotency_key text)\n RETURNS jsonb\n LANGUAGE plpgsql\n SECURITY DEFINER\n SET search_path TO 'public'\nAS $function$\ndeclare v_wallet public.student_wallets%rowtype; v_existing public.coin_transactions%rowtype; v_next_balance integer; v_transaction public.coin_transactions%rowtype;\nbegin\n  if p_idempotency_key is not null then\n    select * into v_existing from public.coin_transactions where idempotency_key = p_idempotency_key;\n    if found then return jsonb_build_object('ok', true, 'alreadyRecorded', true, 'transactionId', v_existing.id); end if;\n  end if;\n  insert into public.student_wallets (student_id, academy_coins, total_coins_earned, total_coins_spent) values (p_student_id, 0, 0, 0) on conflict (student_id) do nothing;\n  select * into v_wallet from public.student_wallets where student_id = p_student_id for update;\n  v_next_balance := v_wallet.academy_coins + p_amount;\n  if v_next_balance < 0 then raise exception 'Not enough Academy Coins.'; end if;\n  update public.student_wallets set academy_coins = v_next_balance, total_coins_earned = total_coins_earned + case when p_amount > 0 then p_amount else 0 end, total_coins_spent = total_coins_spent + case when p_amount < 0 then abs(p_amount) else 0 end where student_id = p_student_id;\n  insert into public.coin_transactions (student_id, amount, transaction_type, source_type, source_id, description, idempotency_key) values (p_student_id, p_amount, p_transaction_type, p_source_type, p_source_id, p_description, p_idempotency_key) returning * into v_transaction;\n  return jsonb_build_object('ok', true, 'alreadyRecorded', false, 'transactionId', v_transaction.id);\nend;\n$function$\n");
  const arena = async () => (await one(`insert into internal_arena_tournaments(name,status,starts_at,ends_at,duration_minutes,time_control_id,time_control)
    values('Verification','active',now()-interval '1 minute',now()+interval '1 hour',60,'10m','{"id":"10m","name":"10 min","initialMs":600000,"incrementMs":0}') returning id`)).id;
  const legacy = await arena();
  await db.exec(sqlFile("20260908143115_academy_arena_experience"));
  assert.equal((await one("select experience_version v from internal_arena_tournaments where id=$1",[legacy])).v,0);
  const a = await arena();
  const ids = [student,second,otherClass];
  const presence = async (id,action="heartbeat",tid=a) => (await one("select arena_queue_presence($1,$2,$3) r",[tid,id,action])).r;
  const dispatch = async (tid=a) => one("select pair_arena_waiting_students($1)",[tid]);
  const entries = async (tid=a) => (await db.query("select * from internal_arena_entries where tournament_id=$1 and student_id is not null order by queue_entered_at,id",[tid])).rows;
  const bot = async (tid=a) => (await one("select manage_internal_arena_bot($1,'add',null,'Practice','knight') id",[tid])).id;
  const b = await bot();
  await presence(student,"join");
  await dispatch();
  assert.equal((await entries())[0].status,"waiting","No bot before five seconds");
  const entered=(await entries())[0].queue_entered_at;
  await presence(student);
  assert.deepEqual((await entries())[0].queue_entered_at,entered,"Heartbeat preserves priority");
  await db.query("update internal_arena_entries set queue_entered_at=now()-interval '6 seconds' where tournament_id=$1 and student_id=$2",[a,student]);
  await presence(second,"join");
  await dispatch();
  const humanGame=(await entries())[0].current_game_id;
  assert.ok(humanGame);
  assert.equal((await one("select arena_bot from live_chess_games where id=$1",[humanGame])).arena_bot,null,"Human opponent beats bot fallback");
  await dispatch();
  assert.equal((await one("select count(*)::int n from internal_arena_pairings where tournament_id=$1",[a])).n,1,"Repeated dispatch cannot overlap games");
  await presence(student,"pause");
  await db.query("update live_chess_games set status='completed',winner_color='white',result_reason='resignation',completed_at=now() where id=$1",[humanGame]);
  await one("select finalize_internal_arena_game($1)",[humanGame]);
  assert.equal((await entries()).find(e=>e.student_id===student).status,"joined","Break persists through completion");
  await presence(student,"join");
  await dispatch();
  assert.equal((await one("select count(*)::int n from internal_arena_pairings where tournament_id=$1",[a])).n,1,"No consecutive human rematch");
  await db.query("update internal_arena_entries set last_seen_at=now()-interval '30 seconds',queue_entered_at=now()-interval '40 seconds' where tournament_id=$1 and student_id is not null",[a]);
  await dispatch();
  assert.equal((await one("select count(*)::int n from internal_arena_pairings where tournament_id=$1",[a])).n,1,"Stale clients cannot be paired");
  await presence(student);
  assert.ok(new Date((await entries()).find(e=>e.student_id===student).queue_entered_at).getTime()>Date.now()-5000,"Reconnect resets stale priority");
  await db.query("update internal_arena_entries set last_seen_at=now()-interval '30 seconds',queue_entered_at=now()-interval '40 seconds' where tournament_id=$1 and student_id=$2",[a,student]);
  await presence(student,"join");
  assert.ok(new Date((await entries()).find(e=>e.student_id===student).queue_entered_at).getTime()>Date.now()-5000,"Explicit rejoin also resets stale priority");
  await db.query("update internal_arena_entries set queue_entered_at=now()-interval '6 seconds' where tournament_id=$1 and student_id=$2",[a,student]);
  await one("select control_internal_arena($1,'pause_pairings')",[a]); await dispatch();
  assert.equal((await entries()).find(e=>e.student_id===student).status,"waiting");
  await one("select control_internal_arena($1,'resume_pairings')",[a]); await dispatch();
  const botGame=(await entries()).find(e=>e.student_id===student).current_game_id;
  assert.ok(botGame,"Bot fallback after five seconds");
  assert.ok((await one("select arena_bot from live_chess_games where id=$1",[botGame])).arena_bot);
  await bot();
  assert.equal((await one("select match_internal_arena_bot_pair($1,$2,$3) r",[a,String(code++),fen])).r.status,"waiting","No automatic exhibitions");
  await one("select control_internal_arena($1,'finish')",[a]);
  assert.equal((await one("select settle_internal_arena($1) r",[a])).r,null,"Early finish waits for active games");
  assert.ok((await one("select ends_at <= now() ended from internal_arena_tournaments where id=$1",[a])).ended);
  await db.query("update live_chess_games set status='completed',winner_color='white',result_reason='resignation',completed_at=now() where id=$1",[botGame]);
  await one("select finalize_internal_arena_game($1)",[botGame]);
  const settled=(await one("select settle_internal_arena($1) r",[a])).r;
  assert.ok(settled.length===2,"Both students with completed games are eligible");
  const coinsBefore=(await one("select sum(amount)::int n from coin_transactions")).n;
  await Promise.all([one("select settle_internal_arena($1)",[a]),one("select settle_internal_arena($1)",[a])]);
  assert.equal((await one("select sum(amount)::int n from coin_transactions")).n,coinsBefore,"Retries cannot double-pay");
  await assert.rejects(one("select control_internal_arena($1,'cancel')",[a]),/ended/);

  // Pure scoring fixtures still exercise the real immutable settlement and coin ledger.
  for (const scores of [[4],[4,2],[4,4],[6,4,4,4],[5,5,5,5],[8,6,4,4],[0,0,0]]) {
    const tid=await arena(); const players=[];
    for (let i=0;i<scores.length;i++) {
      const id=(await one("insert into students(display_name,is_active) values($1,true) returning id",["Tie "+i])).id;players.push(id);
      await db.query("insert into internal_arena_entries(tournament_id,student_id,status,score,wins,losses,games_played) values($1,$2,'joined',$3,0,$4,$4)",[tid,id,scores[i],scores[i]===0?0:2]);
    }
    await one("select control_internal_arena($1,'finish')",[tid]);
    const result=(await one("select settle_internal_arena($1) r",[tid])).r;
    const expected = scores.length===1?[100]:scores.join() === "4,2"?[100,50]:scores.join()==="4,4"?[75,75]:scores.join()==="6,4,4,4"?[100,26,26,26]:scores.join()==="5,5,5,5"?[45,45,45,45]:scores.join()==="8,6,4,4"?[100,50,15,15]:[];
    assert.deepEqual(result.map(p=>p.coins).sort((a,b)=>b-a),expected,"Prize tie split "+scores);
    assert.ok(result.every(p=>players.includes(p.studentId)));
    await assert.rejects(db.query("delete from internal_arena_tournaments where id=$1",[tid]),/foreign key/);
  }
const headArena=await arena();
  await presence(student,"join",headArena); await presence(second,"join",headArena); await dispatch(headArena);
  const headGame=(await entries(headArena))[0].current_game_id;
  const white=(await one("select white_player_id id from live_chess_games where id=$1",[headGame])).id;
  await db.query("update live_chess_games set status='completed',winner_color='white',result_reason='resignation',completed_at=now() where id=$1",[headGame]);
  await one("select finalize_internal_arena_game($1)",[headGame]);
  await db.query("update internal_arena_entries set score=4,wins=1,losses=1,draws=0,games_played=2 where tournament_id=$1",[headArena]);
  let headRanks=(await one("select arena_student_standings($1,true) r",[headArena])).r;
  assert.equal(headRanks[0].studentId,white,"Complete head-to-head breaks points/wins tie");
  assert.deepEqual(headRanks.map(e=>e.rank),[1,2]);
  await db.query("insert into internal_arena_entries(tournament_id,student_id,status,score,wins,losses,games_played) values($1,$2,'joined',4,1,1,2)",[headArena,otherClass]);
  headRanks=(await one("select arena_student_standings($1,true) r",[headArena])).r;
  assert.deepEqual(headRanks.map(e=>e.rank),[1,1,1],"Incomplete tied group retains whole tie");
  await one("select control_internal_arena($1,'finish')",[headArena]);
  await db.exec(`create function fail_test_payout() returns trigger language plpgsql as $$ begin if new.student_id='22222222-2222-4222-8222-222222222222' then raise exception 'Injected payout failure'; end if; return new; end $$;
    create trigger fail_test_payout before insert on coin_transactions for each row execute function fail_test_payout();`);
  const walletBefore=(await one("select sum(academy_coins)::int n from student_wallets")).n;
  await assert.rejects(one("select settle_internal_arena($1)",[headArena]),/Injected payout failure/);
  assert.equal((await one("select count(*)::int n from internal_arena_results where tournament_id=$1",[headArena])).n,0,"Failed ledger rolls snapshot back");
  assert.equal((await one("select sum(academy_coins)::int n from student_wallets")).n,walletBefore,"All partial payments roll back");
  await db.exec("drop trigger fail_test_payout on coin_transactions; drop function fail_test_payout()");
  assert.deepEqual((await one("select settle_internal_arena($1) r",[headArena])).r.map(e=>e.coins),[60,60,60],"Failure is retryable");

  const fifo=await arena();
  for (const id of ids) await presence(id,"join",fifo);
  await db.query("update internal_arena_entries set queue_entered_at=now()-case student_id when $2 then interval '3 seconds' when $3 then interval '2 seconds' else interval '1 second' end where tournament_id=$1",[fifo,student,second]);
  await dispatch(fifo);
  assert.equal((await entries(fifo)).find(e=>e.student_id===otherClass).status,"waiting","Two longest waiting students pair first");
  await one("select control_internal_arena($1,'finish')",[fifo]);
  const exhibition=await arena();
  const botOne=await bot(exhibition),botTwo=await bot(exhibition);
  await presence(otherClass,"join",exhibition);
  await assert.rejects(one("select match_internal_arena_bot_pair($1,$2,$3,$4,$5)",[exhibition,String(code++),fen,botOne,botTwo]),/reserved/);
  await presence(otherClass,"pause",exhibition);
  assert.equal((await one("select match_internal_arena_bot_pair($1,$2,$3,$4,$5) r",[exhibition,String(code++),fen,botOne,botTwo])).r.status,"matched","Teacher exhibition allowed when no student needs a bot");
  const cancelled=await arena();
  await one("select control_internal_arena($1,'cancel')",[cancelled]);
  assert.equal((await one("select settle_internal_arena($1) r",[cancelled])).r,null);
  assert.equal((await one("select settle_internal_arena($1) r",[legacy])).r,null);
  assert.equal((await one("select has_function_privilege('anon','public.settle_internal_arena(uuid)','EXECUTE') allowed")).allowed,false);
  assert.equal((await one("select has_table_privilege('service_role','public.internal_arena_results','UPDATE') allowed")).allowed,false);
  assert.equal((await one("select count(*)::int n from activity_events")).n,(await one("select count(*)::int n from coin_transactions")).n);
  console.log("PASS: migration, queue timing, human priority, stale/reconnect, breaks, no repeats, pause, bot fallback, early finish, late games, ties, eligibility, cancellation, legacy, ledger idempotency and permissions");
} catch (error) {
  console.error(error.message, error.detail ?? "", error.where ?? "");
  process.exitCode=1;
} finally { await db.close(); }
