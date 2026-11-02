import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createBattleTestDatabase } from '../fixtures/puzzle-battle-db.mjs';
const db = await createBattleTestDatabase();
const host = randomUUID();
const state = { status:'waiting', players:[{id:host,name:'Test',ready:true,score:0,index:0,revision:0,moveIndex:0,mistakes:0,done:false,forfeited:false,lastAction:null}],startsAt:null,endsAt:null,winnerId:null };
const create = async () => {
  const id=randomUUID();
  await db.query('select create_puzzle_battle($1,$2,$3,$4,$5,$6,$7)',[id,id.slice(0,8),host,'hide-and-seek',60,JSON.stringify(state),JSON.stringify([{kind:'fixture'}])]);
  return id;
};
const finish = id => db.query("update puzzle_battles set state=jsonb_set(state,'{status}','\"finished\"') where id=$1",[id]);
try {
  await db.query('insert into students(id) values($1)',[host]);
  await db.exec('set role service_role');
  for(let i=0;i<10;i++) {
    const id=await create(); await finish(id);
    await db.query("update puzzle_battles set created_at=clock_timestamp()-interval '2 minutes' where id=$1",[id]);
  }
  // Ten completed short races in the last ten minutes must not block new play.
  for(let i=0;i<20;i++) { const id=await create(); await finish(id); }
  await assert.rejects(create,/wait up to a minute/);
  await db.query("update puzzle_battles set created_at=clock_timestamp()-interval '2 minutes' where host_id=$1",[host]);
  const waiting=await create();
  await assert.rejects(create,/current puzzle battle/);
  await db.query("update puzzle_battles set expires_at=clock_timestamp()-interval '1 second' where id=$1",[waiting]);
  const next=await create();
  await finish(next);
  assert.equal((await db.query('select count(*)::int n from puzzle_battles where host_id=$1',[host])).rows[0].n,32,'Previous results are preserved');
  await db.exec('reset role; set role anon');
  await assert.rejects(create,/permission denied/);
  await db.exec('reset role; set role authenticated');
  await assert.rejects(create,/permission denied/);
  console.log('PASS creation: quick completed races allowed, 20/minute burst limit, cooldown recovery, one active room, expired challenge ignored, history retained, service-only permissions.');
} finally { await db.close(); }
