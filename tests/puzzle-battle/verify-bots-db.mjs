import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createBattleTestDatabase } from "../fixtures/puzzle-battle-db.mjs";
const db = await createBattleTestDatabase();
const human = randomUUID(), outsider = randomUUID();
const player = id => ({ id, name: id, ready: true, score: 0, mistakes: 0, index: 0,
  moveIndex: 0, revision: 0, done: false, forfeited: false, lastAction: null });
const plan = [{ atMs: 6000, solved: true }, { atMs: 12000, solved: false },
  { atMs: 18000, solved: false }, { atMs: 24000, solved: false }];
const state = () => ({ status: "playing", players: [player(human), player("bot:gentle")],
  startsAt: null, endsAt: null, winnerId: null, bot: { level: "gentle", nextAt: null } });
const create = async (mode = "survival", events = plan, source = null) => {
  const id = randomUUID();
  return (await db.query("select create_puzzle_bot_battle($1,$2,$3,$4,60,$5,$6,$7,$8) value",
    [id,id.slice(0,8),human,mode,JSON.stringify(state()),JSON.stringify(events.map(() => ({ fixture:true }))),JSON.stringify(events),source])).rows[0].value;
};
const advance = async id => (await db.query("select advance_puzzle_battle_bot($1) value",[id])).rows[0].value;
const age = (id, ms) => db.query("update puzzle_battles set state=jsonb_set(state,'{startsAt}',to_jsonb($2::numeric)) where id=$1",[id,Date.now()-ms]);
const patch = async (id, changes) => (await db.query("select submit_puzzle_battle_player($1,$2,$3,0,$4) value",
  [id,human,JSON.stringify({provider:"academy",username:"tester"}),JSON.stringify({...player(human),revision:1,...changes})])).rows[0].value;
try {
  await db.query("insert into students(id) values($1),($2)",[human,outsider]);
  await db.query("insert into student_login_credentials values($1,'tester'),($2,'outsider')",[human,outsider]);
  await db.exec("set role service_role");
  const id = await create();
  let record = await advance(id);
  assert.equal(record.guest_id,null);
  assert.ok(record.state.startsAt > Date.now()+3000);
  assert.equal(record.state.endsAt-record.state.startsAt,60000);
  assert.equal(record.state.players[1].score,0);
  await assert.rejects(()=>create(),/current puzzle battle/);
  const loaded = (await db.query("select load_puzzle_battle($1,$2,$3,true) value",[id,human,JSON.stringify({provider:"academy",username:"tester"})])).rows[0].value;
  assert.equal(loaded.deck.length,4);
  assert.ok(!JSON.stringify(loaded).includes("solved"),"Private future outcomes never leave the loader");
  await assert.rejects(()=>db.query("select load_puzzle_battle($1,$2,$3,true)",[id,outsider,JSON.stringify({provider:"academy",username:"outsider"})]),/other players/);
  await age(id,7000);
  record=await advance(id); assert.equal(record.state.players[1].score,1);
  assert.deepEqual(await advance(id),record,"Reloads do not repeat bot scores or mutate unchanged rooms");
  await age(id,26000);
  record=await advance(id); assert.equal(record.state.players[1].mistakes,3);
  assert.equal(record.state.players[1].done,true); assert.equal(record.state.bot.nextAt,null);
  record=await patch(id,{score:2,index:2,done:true});
  assert.equal(record.state.winnerId,human); assert.equal(record.state.status,"finished");
  const next=await create("survival",plan,id);
  assert.equal(await create("survival",plan,id),next,"Retry reuses the rematch");
  record=await advance(next);
  assert.equal(record.state.players[1].index,0);
  // Forfeits use the original whole-room writer; a bot ID must never be cast to uuid.
  const forfeit={...record.state,status:"finished",winnerId:"bot:gentle"};
  assert.equal((await db.query("select write_puzzle_battle($1,$2,$3,$4) value",[next,record.version,human,JSON.stringify(forfeit)])).rows[0].value,true);
  for (const solved of [true,false]) {
    const hide=await create("hide-and-seek",[{atMs:6000,solved}]);
    await age(hide,7000);
    record=await patch(hide,{score:1,index:1,done:true});
    assert.equal(record.state.winnerId,solved?"bot:gentle":human);
    assert.equal(record.state.players[0].score,0,"A human finish after the bot event cannot overwrite it");
  }
  const quick=await create("hide-and-seek",[{atMs:6000,solved:true}]);
  await age(quick,1000);
  record=await patch(quick,{score:1,index:1,done:true});
  assert.equal(record.state.winnerId,human);
  assert.equal((await advance(quick)).state.players[1].score,0,"Bot stops after human wins");
  const missed=await create("hide-and-seek",[{atMs:6000,solved:true}]);
  await age(missed,1000);
  assert.equal((await patch(missed,{mistakes:1,index:1,done:true})).state.winnerId,"bot:gentle");
  const timed=await create("star-wars");
  await age(timed,7000);
  await db.query("update puzzle_battles set state=jsonb_set(state,'{endsAt}',to_jsonb($2::numeric)) where id=$1",[timed,Date.now()-100]);
  record=await advance(timed); assert.equal(record.state.status,"finished");
  assert.equal(record.state.players[1].score,1); assert.equal(record.state.winnerId,"bot:gentle");
  for (const role of ["anon","authenticated"]) {
    await db.exec(`reset role;set role ${role}`);
    await assert.rejects(()=>advance(id),/permission/);
    await assert.rejects(()=>create(),/permission/);
    await assert.rejects(()=>db.query("select bot_plan from puzzle_battle_decks"),/permission/);
  }
  console.log("PASS bot database: countdown, private plans, due events, reload, three lives, first-finish races, stale answer protection, rematches, forfeits, deadlines, permissions.");
} finally { await db.close(); }
