import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createBattleTestDatabase } from "../fixtures/puzzle-battle-db.mjs";
const player=(id,name)=>({id,name,ready:true,score:0,mistakes:0,index:0,moveIndex:0,revision:0,done:false,forfeited:false,lastAction:null});
test("tournaments persist fair rounds, private bots, final results and access controls",async()=>{
  const db=await createBattleTestDatabase({tournaments:true});
  try {
    const tid=randomUUID(), humans=[randomUUID(),randomUUID(),randomUUID()], entries=Array.from({length:5},()=>randomUUID());
    for(const id of humans) await db.query("insert into students(id) values($1)",[id]);
    const call=async(sql,args=[])=>(await db.query(sql,args)).rows[0]?.value;
    await db.query("select create_puzzle_tournament($1,'Class Cup','hide-and-seek',60,2)",[tid]);
    for(let i=0;i<5;i++) await db.query("select edit_puzzle_tournament_entry($1,$2,$3)",[tid,i<3?'join':'bot',JSON.stringify({id:entries[i],studentId:humans[i],name:`Player ${i}`,elo:i<3?undefined:800})]);
    const snap=()=>call("select puzzle_tournament_snapshot($1,true,null) value",[tid]);
    const initial=await snap(); assert.equal(initial.entries.length,5);
    const deck=JSON.stringify([{kind:"hide-and-seek",puzzle:{seed:"same-board",pieces:[],safeSquares:["a1"]}}]);
    const pairs=[{a:entries[0],b:entries[1],state:{players:[player(humans[0],"Player 0"),player(humans[1],"Player 1")]}},
      {a:entries[2],b:entries[3],state:{players:[player(humans[2],"Player 2"),player("bot:steady","Player 3")]},plan:[{atMs:15000,solved:true}]},
      {a:entries[4],b:null}];
    await db.query("select start_puzzle_tournament_round($1,$2,$3,$4)",[tid,initial.version,JSON.stringify(pairs),deck]);
    await assert.rejects(()=>db.query("select start_puzzle_tournament_round($1,$2,$3,$4)",[tid,initial.version,JSON.stringify(pairs),deck]),/changed/);
    await assert.rejects(()=>db.query("select edit_puzzle_tournament_entry($1,'join',$2)",[tid,JSON.stringify({id:randomUUID(),studentId:humans[0],name:"Late"})]),/locked/);
    const t=await snap();assert.equal(t.round,1);assert.equal(t.matches.length,3);
    const decks=(await db.query("select challenges from puzzle_battle_decks")).rows;assert.deepEqual(decks[0],decks[1]);
    const student=await call("select puzzle_tournament_snapshot($1,false,$2) value",[tid,humans[0]]);
    assert.equal(student.me,entries[0]);assert.ok(student.entries.every(e=>e.elo===undefined&&e.studentId===null));
    assert.equal(student.matches.filter(m=>m.battleId).length,1);
    const duel=t.matches.find(m=>m.a===entries[0]);
    await db.query("update puzzle_battles set state=jsonb_set(state,'{startsAt}',to_jsonb($2::numeric)) where id=$1",[duel.battleId,Date.now()-100]);
    const win={...player(humans[0],"Player 0"),score:1,index:1,revision:1,done:true};
    await db.query("select write_puzzle_battle_player($1,$2,0,$3)",[duel.battleId,humans[0],JSON.stringify(win)]);
    await db.query("update puzzle_battles set state=jsonb_set(state,'{endsAt}',to_jsonb($1::numeric)) where state->>'status'='playing'",[Date.now()-10]);
    const done=await snap();assert.equal(done.matches.find(m=>m.id===duel.id).result.winnerEntryId,entries[0]);
    assert.ok(done.matches.every(m=>m.result));
    const privateResult={winnerEntryId:entries[3],scoreA:1,scoreB:0,reason:"played"};
    const next=[{a:entries[0],b:entries[2],state:{players:[player(humans[0],"Player 0"),player(humans[2],"Player 2")]}},
      {a:entries[3],b:entries[4],afterMs:15000,result:privateResult},{a:entries[1],b:null}];
    await db.query("select start_puzzle_tournament_round($1,$2,$3,$4)",[tid,done.version,JSON.stringify(next),deck]);
    const pending=await snap();assert.equal(pending.matches.find(m=>m.round===2&&m.a===entries[3]).result,null);
    assert.ok(!JSON.stringify(pending).includes("bot_result"));
    await db.query("update puzzle_battles set state=jsonb_set(state,'{endsAt}',to_jsonb($1::numeric)) where state->>'status'='playing'",[Date.now()-10]);
    await db.exec("update puzzle_tournament_matches set finishes_at=clock_timestamp()-interval '1 second' where bot_result is not null");
    const final=await snap();assert.equal(final.status,"finished");assert.deepEqual(final.matches.find(m=>m.round===2&&m.a===entries[3]).result,privateResult);
    assert.deepEqual(await snap(),final);
    await db.exec("set role anon");
    await assert.rejects(()=>db.query("select list_puzzle_tournaments()"),/permission denied/);
    await assert.rejects(()=>db.query("select * from puzzle_tournament_matches"),/permission denied/);
    await db.exec("reset role");
    const rls=(await db.query("select relrowsecurity from pg_class where relname in ('puzzle_battle_tournaments','puzzle_tournament_matches','puzzle_tournament_entries')")).rows;
    assert.ok(rls.every(r=>r.relrowsecurity));
  } finally {await db.close();}
});

test("round creation is atomic, roster retries are safe, and cancellation preserves completed results",async()=>{
  const db=await createBattleTestDatabase({tournaments:true});
  try {
    const tid=randomUUID(), sid=randomUUID(), human=randomUUID(), bots=[randomUUID(),randomUUID(),randomUUID()];
    await db.query("insert into students(id) values($1)",[sid]);
    await db.query("select create_puzzle_tournament($1,'Guard Cup','hide-and-seek',60,2)",[tid]);
    await db.query("select edit_puzzle_tournament_entry($1,'join',$2)",[tid,JSON.stringify({id:human,studentId:sid,name:"Explorer"})]);
    for(const id of bots) {
      const args=[tid,JSON.stringify({id,name:"Knight",elo:725})];
      await db.query("select edit_puzzle_tournament_entry($1,'bot',$2)",args);
      await db.query("select edit_puzzle_tournament_entry($1,'bot',$2)",args);
    }
    const snap=async()=>(await db.query("select puzzle_tournament_snapshot($1,true,null) value",[tid])).rows[0].value;
    const initial=await snap();assert.equal(initial.entries.length,4);
    const deck=JSON.stringify([{kind:"hide-and-seek",puzzle:{seed:"guard-board",pieces:[],safeSquares:["a1"]}}]);
    const pairs=[{a:human,b:bots[0],state:{players:[player(sid,"Explorer"),player("bot:steady","Knight")]},plan:[{atMs:55000,solved:true}]},
      {a:bots[1],b:bots[2],afterMs:55000,result:{winnerEntryId:bots[1],scoreA:1,scoreB:0,reason:"played"}}];
    const start=()=>db.query("select start_puzzle_tournament_round($1,$2,$3,$4)",[tid,initial.version,JSON.stringify(pairs),deck]);
    const casual=randomUUID();
    await db.query("insert into puzzle_battles(id,code,host_id,mode,duration,state,expires_at) values($1,'BUSYTEST',$2,'survival',60,$3,clock_timestamp()+interval '5 minutes')",[casual,sid,JSON.stringify({status:"waiting",players:[player(sid,"Explorer")]})]);
    await assert.rejects(start,/still in another/);
    assert.equal((await snap()).round,0);
    assert.equal((await snap()).matches.length,0);
    await db.query("delete from puzzle_battles where id=$1",[casual]);
    await assert.rejects(()=>db.query("select start_puzzle_tournament_round($1,$2,$3,$4)",[tid,initial.version,JSON.stringify([pairs[0]]),deck]),/Every player/);
    assert.equal((await db.query("select count(*)::integer n from puzzle_battles")).rows[0].n,0);
    await start();
    const active=await snap(), duel=active.matches.find(m=>m.battleId);
    await db.query("update puzzle_battles set state=state||jsonb_build_object('status','finished','winnerId',$2::text) where id=$1",[duel.battleId,sid]);
    await db.query("select cancel_puzzle_tournament($1)",[tid]);
    const cancelled=await snap();assert.equal(cancelled.status,"cancelled");
    assert.equal(cancelled.matches.find(m=>m.id===duel.id).result.winnerEntryId,human);
    assert.equal(cancelled.matches.find(m=>m.id!==duel.id).result.reason,"cancelled");
    await db.query("select cancel_puzzle_tournament($1)",[tid]);
    assert.deepEqual(await snap(),cancelled);
    await db.exec("set role authenticated");
    await assert.rejects(()=>db.query("select puzzle_tournament_snapshot($1,true,null)",[tid]),/permission denied/);
    await db.exec("reset role");
    await db.exec("set role service_role");
    assert.equal((await db.query("select list_puzzle_tournaments() value")).rows[0].value.length,1);
    await db.exec("reset role");
  } finally {await db.close();}
});
