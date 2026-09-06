// Local-only transaction checks. Pass the path to an installed @electric-sql/pglite package.
// No connection to the shared database is made.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import path from "node:path";

const { PGlite } = await import(pathToFileURL(path.join(process.argv[2], "dist/index.js")).href);
const db = new PGlite();
await db.exec(`
  create role anon; create role authenticated; create role service_role bypassrls;
  create table students (id uuid primary key default gen_random_uuid(), is_active boolean default true);
  create table badges (id uuid primary key default gen_random_uuid(), name text not null, description text, category text not null,
    tier text not null check (tier in ('C','B','A','S')), xp_value integer default 0, unlock_requirement text, visual_theme text,
    art_image_url text, final_image_url text, generation_status text, created_at timestamptz default now());
  create table student_badges (id uuid primary key default gen_random_uuid(), student_id uuid references students, badge_id uuid references badges,
    note text, awarded_at timestamptz default now(), unique(student_id,badge_id));
  create table chess_puzzles (id uuid primary key default gen_random_uuid(), themes text[]);
  create table student_puzzle_attempts (id uuid primary key default gen_random_uuid(), student_id uuid references students,
    puzzle_id uuid references chess_puzzles, session_id uuid default gen_random_uuid(), training_mode text, solved boolean);
  create table student_wallets (student_id uuid primary key references students, academy_coins integer, total_coins_earned integer, total_coins_spent integer);
  create table coin_transactions (id uuid primary key default gen_random_uuid(), student_id uuid references students, amount integer,
    transaction_type text, source_type text, source_id text, description text, idempotency_key text unique);
  grant all on all tables in schema public to service_role;
  create function grant_academy_coins(p_student_id uuid, p_amount integer, p_transaction_type text, p_source_type text,
    p_source_id text, p_description text, p_idempotency_key text) returns jsonb language plpgsql security definer set search_path = public as $$
  declare v_wallet public.student_wallets%rowtype; v_existing public.coin_transactions%rowtype; v_next_balance integer; v_transaction public.coin_transactions%rowtype;
  begin
    if p_idempotency_key is not null then
      select * into v_existing from public.coin_transactions where idempotency_key = p_idempotency_key;
      if found then return jsonb_build_object('ok', true, 'alreadyRecorded', true, 'transactionId', v_existing.id); end if;
    end if;
    insert into public.student_wallets values(p_student_id,0,0,0) on conflict(student_id) do nothing;
    select * into v_wallet from public.student_wallets where student_id=p_student_id for update;
    v_next_balance := v_wallet.academy_coins + p_amount;
    if v_next_balance < 0 then raise exception 'Not enough Academy Coins.'; end if;
    update public.student_wallets set academy_coins=v_next_balance,
      total_coins_earned=total_coins_earned + case when p_amount>0 then p_amount else 0 end,
      total_coins_spent=total_coins_spent + case when p_amount<0 then abs(p_amount) else 0 end where student_id=p_student_id;
    insert into public.coin_transactions(student_id,amount,transaction_type,source_type,source_id,description,idempotency_key)
      values(p_student_id,p_amount,p_transaction_type,p_source_type,p_source_id,p_description,p_idempotency_key) returning * into v_transaction;
    return jsonb_build_object('ok',true,'alreadyRecorded',false,'transactionId',v_transaction.id);
  end $$;
  insert into badges(name,category,tier,xp_value,final_image_url) values('Pin Grandmaster','Tactics','S',50,'/existing-art.png');
`);
const original = (await db.query("select id from badges")).rows[0].id;
await db.exec(await readFile(new URL("../supabase/migrations/20260906073935_survival_tactical_badges.sql", import.meta.url), "utf8"));
assert.equal((await db.query("select count(*)::int as n from survival_tactical_badge_rules")).rows[0].n, 40);
assert.deepEqual((await db.query("select id,final_image_url,xp_value from badges where name='Pin Grandmaster'")).rows[0], { id: original, final_image_url: "/existing-art.png", xp_value: 50 });

const student = (await db.query("insert into students default values returning id")).rows[0].id;
const puzzles = (await db.query("insert into chess_puzzles(themes) select array['pin'] from generate_series(1,80) returning id")).rows.map((r) => r.id);
async function attempt(puzzle, mode = "survival", solved = true) {
  await db.query("insert into student_puzzle_attempts(student_id,puzzle_id,training_mode,solved) values($1,$2,$3,$4)", [student,puzzle,mode,solved]);
}
async function award() {
  await db.exec("set role service_role");
  try { return (await db.query("select award_survival_tactical_badges($1) as rewards", [student])).rows[0].rewards; }
  finally { await db.exec("reset role"); }
}
for (let i=0;i<40;i++) await attempt(puzzles[i], i%2 ? "daily" : "woodpecker");
for (let i=0;i<40;i++) await attempt(puzzles[i], "survival", false);
assert.deepEqual(await award(), []);
for (let i=0;i<9;i++) await attempt(puzzles[i]);
for (let i=0;i<20;i++) await attempt(puzzles[0]);
assert.deepEqual(await award(), [], "Repeat solves must not advance the threshold");
const expected = new Map([[10,['Bronze',20]], [20,['Silver',40]], [30,['Gold',100]], [40,['Platinum',200]]]);
for (let n=10;n<=40;n++) {
  await attempt(puzzles[n-1]);
  const rewards = await award();
  if (expected.has(n)) {
    const [tier,coins] = expected.get(n);
    assert.equal(rewards.length,1);
    assert.equal(rewards[0].tier,tier);
    assert.equal(rewards[0].coins,coins);
  } else assert.deepEqual(rewards,[]);
  assert.deepEqual(await award(),[], "Retries must not grant a badge twice");
}
assert.equal((await db.query("select academy_coins from student_wallets where student_id=$1",[student])).rows[0].academy_coins,360);

// Mixed-mode puzzles count every tagged tactic. Existing awards are not paid again.
await db.query("insert into student_badges(student_id,badge_id) select $1,badge_id from survival_tactical_badge_rules where tactic_theme='Fork' and tier='C'",[student]);
const forks=(await db.query("insert into chess_puzzles(themes) select array['fork','pin'] from generate_series(1,10) returning id")).rows;
for(const puzzle of forks) await attempt(puzzle.id);
const mixed=await award();
assert.equal(mixed.length,1);
assert.match(mixed[0].name,/Double Attack/);

// Force the coin ledger write to fail: the badge insert and wallet must roll back too.
const inactive=(await db.query("insert into students(is_active) values(false) returning id")).rows[0].id;
await db.query("insert into student_puzzle_attempts(student_id,puzzle_id,training_mode,solved) select $1,id,'survival',true from chess_puzzles",[inactive]);
assert.deepEqual((await db.query("select award_survival_tactical_badges($1) as rewards",[inactive])).rows[0].rewards,[]);
await db.query("update students set is_active=true where id=$1",[inactive]);
await db.exec("alter table coin_transactions add constraint force_failure check(amount < 1000) not valid");
await db.exec("update survival_tactical_badge_rules set coins=1000");
await assert.rejects(db.query("select award_survival_tactical_badges($1)",[inactive]), /force_failure/);
assert.equal((await db.query("select count(*)::int as n from student_badges where student_id=$1",[inactive])).rows[0].n,0);
assert.equal((await db.query("select count(*)::int as n from student_wallets where student_id=$1",[inactive])).rows[0].n,0);
for (const role of ['anon','authenticated']) {
  assert.equal((await db.query("select has_function_privilege($1,'award_survival_tactical_badges(uuid)','execute') as allowed",[role])).rows[0].allowed,false);
}
await db.close();
console.log("PASS: all thresholds, exact coins, distinct solves, other modes, mixed themes, existing awards, retries, inactive students, rollback, and role permissions.");
