import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createBattleTestDatabase } from "../fixtures/puzzle-battle-db.mjs";
const player=(id,name)=>({id,name,ready:true,score:0,mistakes:0,index:0,moveIndex:0,revision:0,done:false,forfeited:false,lastAction:null});

test("late students and bots enter the next round without changing current matches or results",async()=>{
  const db=await createBattleTestDatabase({tournaments:true});
  try {
    const tid=randomUUID(),sid=randomUUID(),a=randomUUID(),b=randomUUID(),h=randomUUID(),lateBot=randomUUID(),extra=randomUUID();
    await db.query("insert into students(id) values($1)",[sid]);
    await db.query("select create_puzzle_tournament($1,'Late Cup','hide-and-seek',60,2)",[tid]);
    const add=(id)=>db.query("select edit_puzzle_tournament_entry($1,'bot',$2)",[tid,JSON.stringify({id,name:"Knight",elo:700})]);
    const snap=async()=>(await db.query("select puzzle_tournament_snapshot($1,true,null) value",[tid])).rows[0].value;
    await add(a);await add(b);
    const deck=JSON.stringify([{kind:"hide-and-seek",puzzle:{pieces:[],safeSquares:["a1"]}}]);
    const botPair=(a,b)=>({a,b,afterMs:55000,result:{winnerEntryId:a,scoreA:1,scoreB:0,reason:"played"}});
    const start=(version,pairs)=>db.query("select start_puzzle_tournament_round($1,$2,$3,$4)",[tid,version,JSON.stringify(pairs),deck]);
    await start((await snap()).version,[botPair(a,b)]);
    const before=await snap();
    const join=()=>db.query("select edit_puzzle_tournament_entry($1,'join',$2)",[tid,JSON.stringify({id:h,studentId:sid,name:"Late learner"})]);
    await join();await add(lateBot);
    const late=await snap();assert.equal(late.entries.length,4);assert.deepEqual(late.matches,before.matches);
    await join();await add(lateBot);assert.deepEqual(await snap(),late);
    const student=(await db.query("select puzzle_tournament_snapshot($1,false,$2) value",[tid,sid])).rows[0].value;
    assert.equal(student.me,h);assert.ok(student.entries.every(e=>e.elo===undefined));
    assert.ok(!student.matches.some(m=>m.a===h||m.b===h));
    for(const action of ["remove","rating","leave"]) await assert.rejects(()=>db.query("select edit_puzzle_tournament_entry($1,$2,$3)",[tid,action,JSON.stringify({id:h,studentId:sid,elo:900})]),/locked/);
    await db.exec("update puzzle_tournament_matches set finishes_at=clock_timestamp()-interval '1 second'");
    const settled=await snap();assert.equal(settled.matches[0].result.winnerEntryId,a);
    assert.equal((await db.query("select claim_puzzle_tournament_round($1,$2,$3) ok",[tid,settled.version,randomUUID()])).rows[0].ok,true);
    await add(extra);
    assert.equal((await db.query("select advance_token from puzzle_battle_tournaments where id=$1",[tid])).rows[0].advance_token,null);
    await assert.rejects(()=>start(settled.version,[]),/changed/);
    const pairs=[{a:h,b:a,state:{players:[player(sid,"Late learner"),player("bot:steady","Knight")]},plan:[{atMs:55000,solved:true}]},botPair(b,lateBot),{a:extra,b:null}];
    await start((await snap()).version,pairs);
    const finalRound=await snap();assert.equal(finalRound.round,2);assert.deepEqual(finalRound.matches[0],settled.matches[0]);
    assert.equal(finalRound.matches.filter(m=>m.round===2).length,3);
    assert.ok(finalRound.matches.find(m=>m.round===2&&m.a===h)?.battleId);
    await assert.rejects(()=>add(randomUUID()),/final round/);
    await db.query("select cancel_puzzle_tournament($1)",[tid]);
    await assert.rejects(()=>add(randomUUID()),/closed/);
  } finally {await db.close();}
});

test("late-entry capacity remains 32 and retries cannot duplicate entrants",async()=>{
  const db=await createBattleTestDatabase({tournaments:true});
  try {
    const tid=randomUUID();await db.query("select create_puzzle_tournament($1,'Capacity','survival',60,3)",[tid]);
    const ids=Array.from({length:32},()=>randomUUID());
    await db.query("insert into puzzle_tournament_entries(id,tournament_id,name,elo) select x,$1,'Knight',700 from unnest($2::uuid[]) x",[tid,ids]);
    await db.query("update puzzle_battle_tournaments set status='active',round=1 where id=$1",[tid]);
    const add=id=>db.query("select edit_puzzle_tournament_entry($1,'bot',$2)",[tid,JSON.stringify({id,name:"Knight",elo:700})]);
    await add(ids[0]);await assert.rejects(()=>add(randomUUID()),/full/);
    assert.equal((await db.query("select count(*)::integer n from puzzle_tournament_entries where tournament_id=$1",[tid])).rows[0].n,32);
  } finally {await db.close();}
});
