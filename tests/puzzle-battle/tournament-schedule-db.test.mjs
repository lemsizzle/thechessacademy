import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createBattleTestDatabase } from "../fixtures/puzzle-battle-db.mjs";

test("scheduled tournaments preserve times, allow edits, and start only when due with enough entrants",async()=>{
  const db=await createBattleTestDatabase({tournaments:true});
  try {
    const id=randomUUID(),a=randomUUID(),b=randomUUID(),token=randomUUID(),future=new Date(Date.now()+3600000).toISOString();
    const create=()=>db.query("select create_scheduled_puzzle_tournament($1,'Scheduled Cup','hide-and-seek',60,2,$2)",[id,future]);
    const snap=async()=>(await db.query("select puzzle_tournament_snapshot($1,true,null) value",[id])).rows[0].value;
    const claim=async(version)=>(await db.query("select claim_puzzle_tournament_round($1,$2,$3) value",[id,version,token])).rows[0].value;
    await assert.rejects(()=>db.query("select create_scheduled_puzzle_tournament($1,'Past','survival',60,1,clock_timestamp()-interval '1 second')",[randomUUID()]),/future/);
    await create();let t=await snap();assert.equal(Date.parse(t.startsAt),Date.parse(future));assert.equal(await claim(t.version),false);
    await db.exec("update puzzle_battle_tournaments set starts_at=clock_timestamp()-interval '1 second'");
    assert.equal(await claim(t.version),false);
    await db.query("select edit_puzzle_tournament_entry($1,'bot',$2)",[id,JSON.stringify({id:a,name:"Maple",elo:500})]);
    t=await snap();assert.equal(await claim(t.version),false);
    await db.query("select edit_puzzle_tournament_entry($1,'bot',$2)",[id,JSON.stringify({id:b,name:"Cedar",elo:750})]);
    t=await snap();assert.equal(await claim(t.version),true);
    await db.query("select set_puzzle_tournament_schedule($1,$2,$3)",[id,t.version,future]);
    const edited=await snap();assert.equal(edited.version,t.version+1);assert.equal(await claim(edited.version),false);
    await create();assert.deepEqual(await snap(),edited); // Retry cannot undo edits.
    await assert.rejects(()=>db.query("select set_puzzle_tournament_schedule($1,$2,null)",[id,t.version]),/changed/);
    await assert.rejects(()=>db.query("select set_puzzle_tournament_schedule($1,$2,clock_timestamp()-interval '1 second')",[id,edited.version]),/future/);
    await db.query("select set_puzzle_tournament_schedule($1,$2,null)",[id,edited.version]);
    t=await snap();assert.equal(t.startsAt,null);assert.equal(await claim(t.version),false);
    await db.query("select set_puzzle_tournament_schedule($1,$2,$3)",[id,t.version,future]);
    t=await snap();const list=(await db.query("select list_puzzle_tournaments() value")).rows[0].value;
    assert.equal(Date.parse(list[0].startsAt),Date.parse(future));
    const pairs=JSON.stringify([{a,b,afterMs:15000,result:{winnerEntryId:a,scoreA:1,scoreB:0,reason:"played"}}]);
    await db.query("select start_puzzle_tournament_round($1,$2,$3,$4)",[id,t.version,pairs,JSON.stringify([{kind:"hide-and-seek"}])]); // Teacher can start early.
    t=await snap();assert.equal(t.status,"active");assert.ok(t.roundStartsAt>Date.now());
    await assert.rejects(()=>db.query("select set_puzzle_tournament_schedule($1,$2,null)",[id,t.version]),/already started/);
    await db.exec("set role authenticated");
    await assert.rejects(()=>db.query("select set_puzzle_tournament_schedule($1,0,null)",[id]),/permission denied/);
    await db.exec("reset role");
  } finally {await db.close();}
});
