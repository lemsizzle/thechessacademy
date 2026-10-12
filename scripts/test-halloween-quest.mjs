// Isolated PostgreSQL test; never connects to production.
import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
import { createHalloweenTestDatabase } from '../tests/fixtures/halloween-db.mjs';
const db = await createHalloweenTestDatabase();
const bots=['pumpkin','ghost','vampire','witch','werewolf'].map(name=>'halloween-2026-'+name);
const standard='rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const student = randomUUID();
await db.query('insert into students(id) values($1)',[student]);
const progress=async()=> (await db.query('select halloween_2026_progress($1) p',[student])).rows[0].p;
const balances=async()=> (await db.query('select s.total_xp xp,coalesce(w.academy_coins,0) coins from students s left join student_wallets w on w.student_id=s.id where s.id=$1',[student])).rows[0];
async function win(bot,overrides={}) {
  const row={player_id:student,opponent_id:bot,initial_fen:standard,moves:JSON.stringify([{from:'e2',to:'e4'}]),started_at:'2026-10-11T01:00:00Z',completed_at:'2026-10-11T01:01:00Z',created_at:'2026-10-11T01:01:01Z',...overrides};
  const keys=Object.keys(row);
  await db.query(`insert into internal_chess_games(${keys.join(',')}) values(${keys.map((_,i)=>'$'+(i+1)).join(',')})`,Object.values(row));
}
assert.equal((await progress()).enabled,true);
assert.deepEqual((await progress()).defeatedBotIds,[]);
for(const override of [
  {hints_used:1},{takeback_count:1},{result:'loss'},{result:'draw'},{opponent_type:'human'},
  {initial_fen:'8/8/8/8/8/8/4K3/7k w - - 0 1'},
  {started_at:'2026-10-10T16:59:59Z'},
  {completed_at:'2026-11-01T17:00:00Z'},
  {created_at:'2026-11-01T17:00:00Z'},
  {created_at:'2026-10-10T16:59:59Z'}
]) await win(bots[0],override);
assert.deepEqual((await progress()).defeatedBotIds,[],'Assisted, non-win, custom-position, and out-of-window results do not count');
await win('pawny');
assert.deepEqual((await progress()).defeatedBotIds,[]);
await win(bots[0]); await win(bots[0]);
assert.equal((await progress()).defeatedBotIds.length,1,'Distinct opponents only');
assert.deepEqual(await balances(),{xp:0,coins:0});
for(const bot of bots.slice(1,4)) await win(bot);
assert.equal((await progress()).defeatedBotIds.length,4);
assert.equal((await progress()).completed,false);
// Last second of November 1 Bangkok time qualifies.
await win(bots[4],{completed_at:'2026-11-01T16:59:59Z',created_at:'2026-11-01T16:59:59Z'});
assert.equal((await progress()).completed,true);
assert.deepEqual(await balances(),{xp:500,coins:500});
await Promise.all([win(bots[4]),win(bots[3]),win(bots[0])]);
assert.deepEqual(await balances(),{xp:500,coins:500},'Repeated and concurrent submissions do not re-award');
assert.equal((await db.query('select count(*) n from quest_completion_events')).rows[0].n,1);
assert.equal((await db.query('select count(*) n from xp_events')).rows[0].n,1);
assert.equal((await db.query('select status from student_quest_attempts')).rows[0].status,'completed');
assert.equal((await db.query('select current_value from lichess_quest_progress')).rows[0].current_value,5);
for (const role of ['anon','authenticated']) {
  const {rows}=await db.query("select has_function_privilege($1,'public.halloween_2026_progress(uuid)','EXECUTE') allowed",[role]);
  assert.equal(rows[0].allowed,false);
}
// A failing reward transaction must roll back the game, XP, progress, and coins.
const second=randomUUID(); await db.query('insert into students(id) values($1)',[second]);
for(const bot of bots.slice(0,4)) await win(bot,{player_id:second});
await db.exec("create function fail_quest_xp() returns trigger language plpgsql as $$ begin raise exception 'Simulated reward failure'; end $$; create trigger fail_quest_xp before insert on xp_events for each row execute function fail_quest_xp();");
await assert.rejects(win(bots[4],{player_id:second}),/Simulated reward failure/);
assert.equal((await db.query('select total_xp from students where id=$1',[second])).rows[0].total_xp,0);
assert.equal((await db.query('select count(*) n from internal_chess_games where player_id=$1',[second])).rows[0].n,4);
await db.close();
console.log('Halloween SQL: distinct wins, hints/takebacks, deadline, XP/coins once, privileges, and rollback passed.');
