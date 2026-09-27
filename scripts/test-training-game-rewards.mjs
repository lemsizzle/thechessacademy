// Isolated PostgreSQL regression test; no production connections or students.
// Uses the same PGlite install as scripts/test-game-achievement-database.mjs.
import { PGlite } from '../work/achievement-db-test/node_modules/@electric-sql/pglite/dist/index.js';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
process.on('uncaughtException', error => { console.error(error.message); console.error(error.stack?.split('\n').filter(line => !line.includes('data:text/javascript')).join('\n').slice(0,2000)); process.exit(1); });

const db = new PGlite();
const read = path => readFileSync(path, 'utf8');
await db.exec(`
create role anon; create role authenticated; create role service_role bypassrls;
create table students(id uuid primary key, total_xp integer default 0, is_active boolean default true);
create table xp_events(id uuid primary key default gen_random_uuid(),student_id uuid references students(id),amount integer,reason text,created_at timestamptz default now());
create table student_wallets(student_id uuid primary key,academy_coins integer default 0,total_coins_earned integer default 0,total_coins_spent integer default 0);
create table coin_transactions(id uuid primary key default gen_random_uuid(),student_id uuid,amount integer,transaction_type text,source_type text,source_id text,description text,idempotency_key text unique);
grant select,update on students to service_role; grant select,insert on xp_events to service_role;
`);
await db.exec(read('tests/fixtures/training-wallet-functions.sql'));
await db.exec('create trigger award_academy_coins_after_xp_event after insert on xp_events for each row execute function award_academy_coins_for_xp_event();');
await db.exec(read('supabase/migrations/20260829084909_add_star_wars_leaderboard.sql'));
await db.exec(read('supabase/migrations/20260829080040_hide_and_seek_training.sql'));
await db.exec(`
alter table student_star_wars_runs add column mode text default 'classic', add column time_limit_ms integer;
alter table student_hide_and_seek_attempts add column mode text default 'classic';
alter table student_hide_and_seek_attempts drop constraint student_hide_and_seek_selected_squares_valid;
alter table student_hide_and_seek_attempts add check(cardinality(selected_squares) between 0 and 56);
`);
const student = randomUUID(), historicalRun = randomUUID();
await db.query('insert into students(id) values($1)', [student]);
await db.query('insert into student_star_wars_runs(student_id,run_id,generator_version,run_variant,score) values($1,$2,1,42,5)', [student,historicalRun]);
await db.exec(read('supabase/migrations/20260924012226_training_game_rewards.sql'));

// Supabase-shaped adapter executes real SQL, including transactions and triggers.
function from(table) {
  assert.ok(['student_star_wars_runs','student_hide_and_seek_attempts'].includes(table));
  let columns='*', operation='select', values, filters=[], ordering='', limit='';
  const params=[];
  const param=value => { params.push(value); return '$'+params.length; };
  const ident=name => { assert.match(name,/^[a-z_]+$/); return name; };
  async function execute() {
    try {
      let sql;
      const where=filters.length ? ' where '+filters.join(' and ') : '';
      if(operation==='select') sql=`select ${columns} from ${table}${where}${ordering}${limit}`;
      else if(operation==='insert') {
        const names=Object.keys(values);
        sql=`insert into ${table}(${names.map(ident).join(',')}) values(${names.map(n=>param(n==='piece_placement'?JSON.stringify(values[n]):values[n])).join(',')}) returning ${columns}`;
      } else sql=`update ${table} set ${Object.keys(values).map(n=>ident(n)+'='+param(values[n])).join(',')}${where} returning ${columns}`;
      const data=JSON.parse(JSON.stringify((await db.query(sql,params)).rows));
      return {data:data[0]??null,error:null};
    } catch(error) { return {data:null,error:{code:error.code,message:error.message}}; }
  }
  const query={
    select(c){columns=c;return query;},
    eq(c,v){filters.push(ident(c)+'='+param(v));return query;},
    lt(c,v){filters.push(ident(c)+'<'+param(v));return query;},
    order(c,{ascending}){ordering=' order by '+ident(c)+(ascending?' asc':' desc');return query;},
    limit(n){limit=' limit '+Number(n);return query;},
    insert(v){operation='insert';values=v;return query;},
    update(v){operation='update';values=v;return query;},
    maybeSingle:execute,single:execute,
    then(resolve,reject){return execute().then(resolve,reject);}
  };
  return query;
}
globalThis.trainingRewardTestClient={from};
const bundle=await build({stdin:{contents:`export * from './lib/puzzle-training/starWarsServer'; export * from './lib/puzzle-training/starWars'; export * from './lib/puzzle-training/hideAndSeekServer'; export * from './lib/puzzle-training/hideAndSeekToken'; export * from './lib/puzzle-training/hideAndSeek';`,resolveDir:process.cwd(),loader:'ts'},bundle:true,write:false,platform:'node',format:'esm',alias:{'@':process.cwd()},plugins:[{name:'isolated-services',setup(b){
  b.onResolve({filter:/^(server-only|@\/lib\/supabase\/server|@\/lib\/auth\/requireActiveStudent)$/},({path})=>({path,namespace:'mock'}));
  b.onLoad({filter:/.*/,namespace:'mock'},({path})=>({contents:path==='server-only'?'':path.includes('supabase')?'export const getSupabaseServiceClient=()=>globalThis.trainingRewardTestClient;':'export class StudentAuthenticationError extends Error{}; export const requireActiveStudent=()=>{};',loader:'js'}));
}}]});
const api=await import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].contents).toString('base64'));
process.env.PUZZLE_SESSION_SECRET='isolated-test-secret-longer-than-24-characters';
const balances=async()=> (await db.query(`select s.total_xp xp,coalesce(w.academy_coins,0) coins from students s left join student_wallets w on w.student_id=s.id where s.id=$1`,[student])).rows[0];
assert.deepEqual(await balances(),{xp:0,coins:0});
await db.query('update student_star_wars_runs set score=6 where run_id=$1',[historicalRun]);
assert.deepEqual(await balances(),{xp:3,coins:3}); // No backfill for the five old levels.

const route=(score,variant)=>api.findStarWarsSolution(api.initialStarWarsState(api.starWarsPuzzleForScore(score,variant)));
for(const mode of ['classic','time_trial']) {
  const run=await api.startStarWarsRun(student,{mode,timeLimitMs:mode==='classic'?null:60000});
  const routes=[route(0,run.runVariant),route(1,run.runVariant)];
  const input={studentId:student,runId:run.runId,startScore:0,routes:[routes[0]]};
  const first=await api.saveStarWarsProgress(input);
  assert.equal(first.rewardXp,3);
  const before=await balances();
  assert.equal((await api.saveStarWarsProgress(input)).rewardXp,3);
  assert.deepEqual(await balances(),before);
  const results=await Promise.all([api.saveStarWarsProgress({...input,routes}),api.saveStarWarsProgress({...input,routes})]);
  assert.ok(results.every(r=>r.rewardXp===6));
  assert.deepEqual(await balances(),{xp:before.xp+3,coins:before.coins+3});
  const saved=await balances();
  await assert.rejects(api.saveStarWarsProgress({...input,startScore:2,routes:[[{from:'a1',to:'a2'}]]}));
  await assert.rejects(api.saveStarWarsProgress({...input,studentId:randomUUID()}));
  assert.deepEqual(await balances(),saved);
}
for(const mode of ['classic','time_trial','hard']) {
  const started=api.startHideAndSeekRound(student,undefined,mode);
  const payload=api.readHideAndSeekRoundToken(started.token,Date.parse(started.round.startedAt));
  const board=api.generateHideAndSeekBoardForVersion(payload.generatorVersion,payload.seed);
  const input={studentId:student,token:started.token,selectedSquares:board.safeSquares,nowMs:Date.parse(started.round.startedAt)+5000};
  const before=await balances();
  const first=await api.finishHideAndSeekRound(input);
  assert.equal(first.rewardXp,10);
  assert.deepEqual(await balances(),{xp:before.xp+10,coins:before.coins+10});
  assert.equal((await api.finishHideAndSeekRound({...input,selectedSquares:[]})).rewardXp,10);
  assert.deepEqual(await balances(),{xp:before.xp+10,coins:before.coins+10});
  // An ON CONFLICT retry must not run payment side effects either.
  await db.query(`insert into student_hide_and_seek_attempts(student_id,round_id,generator_version,seed,piece_placement,selected_squares,safe_square_count,correct_count,wrong_count,found_percent,elapsed_ms,score,started_at,completed_at,mode)
    select student_id,round_id,generator_version,seed,piece_placement,selected_squares,safe_square_count,correct_count,wrong_count,found_percent,elapsed_ms,score,started_at,completed_at,mode from student_hide_and_seek_attempts where round_id=$1 on conflict(student_id,round_id) do nothing`,[payload.roundId]);
  assert.deepEqual(await balances(),{xp:before.xp+10,coins:before.coins+10});
  const partial=api.startHideAndSeekRound(student,undefined,mode);
  const p=api.readHideAndSeekRoundToken(partial.token,Date.parse(partial.round.startedAt));
  const b=api.generateHideAndSeekBoardForVersion(p.generatorVersion,p.seed);
  assert.equal((await api.finishHideAndSeekRound({studentId:student,token:partial.token,selectedSquares:[b.safeSquares[0]],nowMs:Date.parse(partial.round.startedAt)+5000})).rewardXp,0);
  assert.deepEqual(await balances(),{xp:before.xp+10,coins:before.coins+10});
}
const hard=api.startHideAndSeekRound(student,undefined,'hard');
const hardToken=api.readHideAndSeekRoundToken(hard.token,Date.parse(hard.round.startedAt));
const hardBoard=api.generateHideAndSeekBoardForVersion(hardToken.generatorVersion,hardToken.seed);
const danger=Array.from({length:64},(_,i)=>String.fromCharCode(97+i%8)+(1+Math.floor(i/8))).find(s=>!hardBoard.safeSquares.includes(s)&&!hardBoard.pieces.some(p=>p.square===s));
const beforeHard=await balances();
assert.equal((await api.finishHideAndSeekRound({studentId:student,token:hard.token,selectedSquares:[...hardBoard.safeSquares,danger],nowMs:Date.parse(hard.round.startedAt)+5000})).rewardXp,0);
assert.deepEqual(await balances(),beforeHard);
// A coin-write failure must roll back XP, the score, and the recorded reward.
const failedRun=await api.startStarWarsRun(student);
await db.exec(`create function fail_coin_test() returns trigger language plpgsql as $$ begin raise exception 'Simulated wallet failure'; end $$; create trigger fail_coin_test before insert on coin_transactions for each row execute function fail_coin_test();`);
const beforeFailure=await balances();
const failing={studentId:student,runId:failedRun.runId,startScore:0,routes:[route(0,failedRun.runVariant)]};
await assert.rejects(api.saveStarWarsProgress(failing),/Simulated wallet failure/);
assert.deepEqual(await balances(),beforeFailure);
assert.deepEqual((await db.query('select score,reward_xp from student_star_wars_runs where run_id=$1',[failedRun.runId])).rows[0],{score:0,reward_xp:0});
const failedHide=api.startHideAndSeekRound(student);
const failedToken=api.readHideAndSeekRoundToken(failedHide.token,Date.parse(failedHide.round.startedAt));
const failedBoard=api.generateHideAndSeekBoardForVersion(failedToken.generatorVersion,failedToken.seed);
const failedHideInput={studentId:student,token:failedHide.token,selectedSquares:failedBoard.safeSquares,nowMs:Date.parse(failedHide.round.startedAt)+5000};
await assert.rejects(api.finishHideAndSeekRound(failedHideInput),/Simulated wallet failure/);
assert.deepEqual(await balances(),beforeFailure);
assert.equal((await db.query('select count(*)::int n from student_hide_and_seek_attempts where round_id=$1',[failedToken.roundId])).rows[0].n,0);
await db.exec('drop trigger fail_coin_test on coin_transactions;');
assert.equal((await api.saveStarWarsProgress(failing)).rewardXp,3);
assert.equal((await api.finishHideAndSeekRound(failedHideInput)).rewardXp,10);
for(const role of ['anon','authenticated']) {
  for(const fn of ['reward_star_wars_progress()','reward_hide_and_seek_completion()']) assert.equal((await db.query('select has_function_privilege($1,$2,\'execute\') allowed',[role,fn])).rows[0].allowed,false);
}
// Run as the same database role used by the application, not only as owner.
await db.exec('set role service_role');
await db.query('update student_star_wars_runs set score=2 where run_id=$1',[failedRun.runId]);
await db.exec('reset role');
assert.deepEqual(await balances(),{xp:beforeFailure.xp+16,coins:beforeFailure.coins+16});
console.log('PASS: verified routes and star selections → persisted scores, XP, coins and API reward totals; all modes; duplicate and overlapping saves; no historical backfill; incomplete/invalid/foreign runs; atomic wallet failure and retry; server-only permissions.');
await db.close();
delete globalThis.trainingRewardTestClient;
