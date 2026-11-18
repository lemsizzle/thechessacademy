import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { PGlite } from '../../work/achievement-db-test/node_modules/@electric-sql/pglite/dist/index.js';
import { installEndgameTestSchema } from '../fixtures/endgame-db.mjs';

test('endgame rewards are atomic, once per attempt, private, and assistance is sticky', async () => {
  const db = new PGlite();
  try {
    await db.exec('create role anon; create role authenticated; create role service_role bypassrls; create table students(id uuid primary key,is_active boolean default true);');
    await installEndgameTestSchema(db);
    const student=randomUUID(),inactive=randomUUID();
    await db.query('insert into students(id,is_active) values($1,true),($2,false)',[student,inactive]);
    const save=async(id,complete,help,who=student)=>(await db.query('select save_endgame_training_reward($1,$2,$3,$4,$5) result',[who,id,'queen-mate',complete,help])).rows[0].result;
    const id=randomUUID();
    await db.exec('set role service_role');
    const receipts=await Promise.all([save(id,true,false),save(id,true,false),save(id,true,false)]);
    assert.equal(receipts.filter(r=>r.awarded).length,1);
    assert.equal((await db.query('select total_xp from students where id=$1',[student])).rows[0].total_xp,3);
    assert.equal((await db.query('select academy_coins from student_wallets where student_id=$1',[student])).rows[0].academy_coins,3);
    assert.equal((await db.query('select count(*)::int n from xp_events where student_id=$1',[student])).rows[0].n,1);
    const assisted=randomUUID(); await save(assisted,false,true);
    assert.equal((await save(assisted,true,false)).rewardXp,0);
    assert.equal((await save(assisted,true,false)).rewardXp,0);
    assert.equal((await save(randomUUID(),true,true)).rewardXp,0);
    await assert.rejects(()=>save(randomUUID(),true,false,inactive),/active student/);
    await save(randomUUID(),true,false);
    assert.equal((await db.query('select total_xp from students where id=$1',[student])).rows[0].total_xp,6);
    assert.equal((await db.query('select academy_coins from student_wallets where student_id=$1',[student])).rows[0].academy_coins,6);
    await db.exec('reset role; set role anon');
    await assert.rejects(()=>save(randomUUID(),true,false),/permission denied/);
    await assert.rejects(()=>db.query('select * from student_endgame_attempts'),/permission denied/);
    await db.exec('reset role; set role authenticated');
    await assert.rejects(()=>save(randomUUID(),true,false),/permission denied/);
    await db.exec('reset role');
    assert.equal((await db.query("select relrowsecurity from pg_class where relname='student_endgame_attempts'")).rows[0].relrowsecurity,true);
  } finally { await db.close(); }
});
