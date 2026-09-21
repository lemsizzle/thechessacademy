// Isolated PostgreSQL verification; never connects to production.
import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { PGlite } from "../work/achievement-db-test/node_modules/@electric-sql/pglite/dist/index.js";
const db = new PGlite();
// Reuse representative existing tables and the idempotent coin function fixture.
const fixture = (await readFile("scripts/verify-survival-badges.mjs", "utf8")).replaceAll("\r\n", "\n");
const schema = fixture.slice(fixture.indexOf("await db.exec(`") + 15, fixture.indexOf("`);\nconst original"));
await db.exec(schema);
await db.exec(`
alter table badges rename constraint badges_tier_check to badges_tier_valid;
alter table students add column total_xp integer default 0;
alter table coin_transactions add column created_at timestamptz default now();
create table xp_events(id uuid primary key default gen_random_uuid(),student_id uuid,amount integer,reason text);
create table academy_activity_rewards(student_id uuid,source_type text,source_id uuid,xp_event_id uuid,xp_amount integer);
create function fixture_coins() returns trigger language plpgsql as $$ begin
 perform public.grant_academy_coins(new.student_id,new.amount,'earn','xp_event',new.id::text,new.reason,'xp_event:'||new.id::text); return new; end $$;
create trigger xp_coins after insert on xp_events for each row execute function fixture_coins();
grant all on all tables in schema public to service_role;
`);
for (const file of ["20260906073935_survival_tactical_badges.sql", "20260906150437_survival_badges_single_theme_round.sql", "20260908081238_survival_round_rewards.sql", "20260909022308_mixed_survival_chaos_mastery.sql", "20260921013738_survival_adamantium_rewards.sql"]) {
  await db.exec(await readFile(`supabase/migrations/${file}`, "utf8"));
}
const adamantium = "ada00000-0000-4000-8000-000000000050";
async function run(theme, {hints=0, mode="survival", count=50, old=false}={}) {
  const student=(await db.query("insert into students default values returning id")).rows[0].id;
  const session=crypto.randomUUID();
  const puzzles=(await db.query("insert into chess_puzzles(themes) select array['pin'] from generate_series(1,$1) returning id",[count])).rows;
  for(const [i,p] of puzzles.entries()) await db.query("insert into student_puzzle_attempts(student_id,puzzle_id,session_id,selected_theme,training_mode,solved,hints_used,attempted_at) values($1,$2,$3,$4,$5,true,$6,now()-($7||' seconds')::interval)",[student,p.id,session,theme,mode,i<hints?1:0,old?3600:0]);
  await db.exec("set role service_role");
  let awards;
  try { awards=(await db.query("select award_survival_tactical_badges($1,$2) as data",[student,session])).rows[0].data; }
  finally { await db.exec("reset role"); }
  return {student,session,awards};
}
for(const theme of ["pin","mixed","advancedPawn"]) {
  const {student,session,awards}=await run(theme);
  assert.equal(awards.find(a=>a.badgeId===adamantium)?.xp,1000);
  assert.equal(awards.find(a=>a.badgeId===adamantium)?.coins,1000);
  const expectedXp=theme==="advancedPawn"?1000:1500;
  const expectedCoins=theme==="advancedPawn"?1000:1660;
  assert.equal((await db.query("select total_xp from students where id=$1",[student])).rows[0].total_xp,expectedXp);
  assert.equal((await db.query("select academy_coins from student_wallets where student_id=$1",[student])).rows[0].academy_coins,expectedCoins);
  const result=(await db.query("select get_survival_round_rewards($1,$2) as data",[student,session])).rows[0].data;
  assert.equal(result.xp,expectedXp); assert.equal(result.badgeCoins,expectedCoins);
  assert.equal(result.badges.find(a=>a.badgeId===adamantium).xp,1000);
  assert.deepEqual((await db.query("select award_survival_tactical_badges($1,$2) as data",[student,session])).rows[0].data,[]);
}
for(const options of [{count:49},{hints:1},{mode:"woodpecker"},{mode:"daily"},{old:true}]) {
  assert.equal((await run("mixed",options)).awards.some(a=>a.badgeId===adamantium),false);
}
const platinum=await run("pin",{count:40});
assert.equal(platinum.awards.find(a=>a.tier==="Platinum").xp,500);
assert.equal(platinum.awards.find(a=>a.tier==="Platinum").coins,500);
console.log("PASS: Platinum 500/500; Adamantium 1000/1000 in focused, mixed and other Survival themes; round totals, retries, score 49, hints, non-Survival and old rounds.");
await db.close();
