import assert from 'node:assert/strict';
import { createSeasonalTestDatabase } from '../fixtures/seasonal-db.mjs';
const db = await createSeasonalTestDatabase();
const student='10000000-0000-4000-8000-000000000001', other='10000000-0000-4000-8000-000000000002';
const ids=['turkey','corn','fox','scarecrow','stag'].map(id=>'thanksgiving-2026-'+id);
const quest='thanksgiving-2026-bot-quest', badge='e7261127-0000-4000-8000-000000000001';
const fen='rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
async function win(bot, values={}) {
  const row={player_id:student,opponent_id:bot,opponent_type:'computer',result:'win',takeback_count:0,hints_used:0,initial_fen:fen,moves:'[{"from":"e2","to":"e4"}]',started_at:'2026-11-01T10:00:00+07:00',completed_at:'2026-11-01T10:03:00+07:00',created_at:'2026-11-01T10:03:00+07:00',...values};
  const keys=Object.keys(row);
  await db.query(`insert into internal_chess_games(${keys.join(',')}) values(${keys.map((_,i)=>'$'+(i+1)).join(',')})`,Object.values(row));
}
async function progress(id=student) {return (await db.query('select seasonal_bot_hunt_progress($1,$2) p',[id,quest])).rows[0].p;}
try {
  await db.query('insert into students(id) values($1),($2)',[student,other]);
  await db.exec('set role service_role;');
  for(const values of [{hints_used:1},{takeback_count:1},{result:'loss'},{result:'draw'},{moves:'[]'},{initial_fen:'custom'},{started_at:'2026-10-31T10:00:00+07:00'},{created_at:'2026-11-28T00:00:00-08:00'},{completed_at:'2026-11-28T00:00:00-08:00'}]) await win(ids[0],values);
  assert.deepEqual((await progress()).defeatedBotIds,[]);
  await win(ids[0],{player_id:other});
  assert.deepEqual((await progress()).defeatedBotIds,[]);
  assert.equal((await progress(other)).defeatedBotIds.length,1);
  for(const id of ids.slice(0,4)) await win(id);
  await win(ids[0]);
  assert.equal((await progress()).defeatedBotIds.length,4);
  assert.equal((await progress()).completed,false);
  assert.equal((await db.query('select count(*)::int n from xp_events')).rows[0].n,0);
  await win(ids[4],{started_at:'2026-11-27T23:55:00-08:00',completed_at:'2026-11-27T23:59:59-08:00',created_at:'2026-11-27T23:59:59-08:00'});
  assert.equal((await progress()).completed,true);
  for(const id of ids) await win(id);
  assert.equal((await db.query('select total_xp from students where id=$1',[student])).rows[0].total_xp,500);
  assert.equal((await db.query('select academy_coins from student_wallets where student_id=$1',[student])).rows[0].academy_coins,500);
  assert.equal((await db.query('select count(*)::int n from student_badges where student_id=$1 and badge_id=$2',[student,badge])).rows[0].n,1);
  assert.equal((await db.query('select count(*)::int n from xp_events where student_id=$1',[student])).rows[0].n,1);
  assert.equal((await db.query('select badge_awarded_id from quest_completion_events where student_id=$1',[student])).rows[0].badge_awarded_id,badge);
  assert.equal((await db.query("select count(*)::int n from quest_completion_events where quest_id='halloween-2026-bot-quest'")).rows[0].n,0);
  // Database security: the public roles cannot call a privileged progress reader.
  await db.exec('reset role; set role anon;');
  await assert.rejects(()=>progress(),/permission denied/);
  await db.exec('reset role; set role authenticated;');
  await assert.rejects(()=>progress(),/permission denied/);
  console.log('PASS seasonal SQL: assisted/late/custom/empty games excluded, distinct wins, student isolation, automatic completion, 500 XP + 500 coins + one badge, replay idempotency, Pacific deadline, restricted roles.');
} finally { await db.close(); }
