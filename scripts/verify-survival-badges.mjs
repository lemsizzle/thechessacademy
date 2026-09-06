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
    puzzle_id uuid references chess_puzzles, session_id uuid default gen_random_uuid(), selected_theme text,
    training_mode text, solved boolean, hints_used integer default 0, attempted_at timestamptz default now(), completed_at timestamptz default now());
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
await db.exec(await readFile(new URL("../supabase/migrations/20260906150437_survival_badges_single_theme_round.sql", import.meta.url), "utf8"));
await db.exec(await readFile(new URL("../supabase/migrations/20260906164159_exclude_hinted_survival_solves_from_badges.sql", import.meta.url), "utf8"));
assert.equal((await db.query("select count(*)::int as n from survival_tactical_badge_rules")).rows[0].n, 40);
assert.equal((await db.query("select count(distinct selected_theme)::int as n from survival_tactical_badge_rules")).rows[0].n, 10);
assert.deepEqual((await db.query("select id,final_image_url,xp_value from badges where name='Pin Grandmaster'")).rows[0], { id: original, final_image_url: "/existing-art.png", xp_value: 50 });

const student = (await db.query("insert into students default values returning id")).rows[0].id;
const pinPuzzles = (await db.query("insert into chess_puzzles(themes) select array['pin'] from generate_series(1,80) returning id")).rows.map((r) => r.id);
const sessions = {
  otherModes: "10000000-0000-4000-8000-000000000001",
  mixed: "10000000-0000-4000-8000-000000000002",
  partialA: "10000000-0000-4000-8000-000000000003",
  partialB: "10000000-0000-4000-8000-000000000004",
  focused: "10000000-0000-4000-8000-000000000005",
  doubleAttack: "10000000-0000-4000-8000-000000000006",
  malformed: "10000000-0000-4000-8000-000000000007",
  inactive: "10000000-0000-4000-8000-000000000008",
  hinted: "10000000-0000-4000-8000-000000000009"
};
async function attempt(puzzle, { studentId = student, session = sessions.focused, theme = "pin", mode = "survival", solved = true, hints = 0 } = {}) {
  await db.query(
    "insert into student_puzzle_attempts(student_id,puzzle_id,session_id,selected_theme,training_mode,solved,hints_used) values($1,$2,$3,$4,$5,$6,$7)",
    [studentId,puzzle,session,theme,mode,solved,hints]
  );
}
async function award(studentId = student, session = sessions.focused) {
  await db.exec("set role service_role");
  try { return (await db.query("select award_survival_tactical_badges($1,$2) as rewards", [studentId,session])).rows[0].rewards; }
  finally { await db.exec("reset role"); }
}

for (let i=0;i<20;i++) await attempt(pinPuzzles[i], { session: sessions.otherModes, mode: i%2 ? "daily" : "woodpecker" });
for (let i=20;i<40;i++) await attempt(pinPuzzles[i], { session: sessions.otherModes, solved: false });
assert.deepEqual(await award(student, sessions.otherModes), [], "Other modes and failed puzzles must not count");

for (let i=0;i<40;i++) await attempt(pinPuzzles[i], { session: sessions.mixed, theme: "mixed" });
assert.deepEqual(await award(student, sessions.mixed), [], "Mixed-theme rounds must not earn tactic badges");

for (let i=0;i<5;i++) await attempt(pinPuzzles[i], { session: sessions.partialA });
for (let i=5;i<10;i++) await attempt(pinPuzzles[i], { session: sessions.partialB });
assert.deepEqual(await award(student, sessions.partialA), []);
assert.deepEqual(await award(student, sessions.partialB), [], "Scores from separate rounds must not combine");

for (let i=0;i<9;i++) await attempt(pinPuzzles[i]);
for (let i=0;i<20;i++) await attempt(pinPuzzles[0]);
assert.deepEqual(await award(), [], "Repeat solves must not advance the threshold");
const expected = new Map([[10,['Bronze',20]], [20,['Silver',40]], [30,['Gold',100]], [40,['Platinum',200]]]);
for (let n=10;n<=40;n++) {
  await attempt(pinPuzzles[n-1]);
  const rewards = n === 10
    ? (await db.query("select award_survival_tactical_badges($1) as rewards", [student])).rows[0].rewards
    : await award();
  if (expected.has(n)) {
    const [tier,coins] = expected.get(n);
    assert.equal(rewards.length,1);
    assert.equal(rewards[0].tier,tier);
    assert.equal(rewards[0].coins,coins);
  } else assert.deepEqual(rewards,[]);
  assert.deepEqual(await award(),[], "Retries must not grant a badge twice");
}
assert.equal((await db.query("select academy_coins from student_wallets where student_id=$1",[student])).rows[0].academy_coins,360);

// Hinted solves do not count, while hint-free solves in the same round do.
const hintStudent = (await db.query("insert into students default values returning id")).rows[0].id;
for (let i=0;i<9;i++) await attempt(pinPuzzles[i], { studentId: hintStudent, session: sessions.hinted });
for (let i=9;i<20;i++) await attempt(pinPuzzles[i], { studentId: hintStudent, session: sessions.hinted, hints: 1 });
assert.deepEqual(await award(hintStudent, sessions.hinted), [], "Hinted solves must not reach the badge threshold");
await attempt(pinPuzzles[20], { studentId: hintStudent, session: sessions.hinted });
const hintFreeThreshold = await award(hintStudent, sessions.hinted);
assert.equal(hintFreeThreshold.length, 1);
assert.equal(hintFreeThreshold[0].tier, "Bronze");
assert.match((await db.query("select note from student_badges where student_id=$1", [hintStudent])).rows[0].note, /10 hint-free pin puzzles/);

// A focused double-check round earns Double Attack, while a fork round cannot.
const doubleChecks=(await db.query("insert into chess_puzzles(themes) select array['doubleCheck'] from generate_series(1,10) returning id")).rows;
for(const puzzle of doubleChecks) await attempt(puzzle.id, { session: sessions.doubleAttack, theme: "doubleCheck" });
const doubleAttack=await award(student, sessions.doubleAttack);
assert.equal(doubleAttack.length,1);
assert.match(doubleAttack[0].name,/Double Attack/);

for(let i=40;i<50;i++) await attempt(pinPuzzles[i], { session: sessions.malformed });
await attempt(pinPuzzles[50], { session: sessions.malformed, theme: "fork" });
assert.deepEqual(await award(student, sessions.malformed), [], "A session containing different selected themes must be rejected");

// Force the coin ledger write to fail: the badge insert and wallet must roll back too.
const inactive=(await db.query("insert into students(is_active) values(false) returning id")).rows[0].id;
for(let i=60;i<70;i++) await attempt(pinPuzzles[i], { studentId: inactive, session: sessions.inactive });
assert.deepEqual(await award(inactive, sessions.inactive),[]);
await db.query("update students set is_active=true where id=$1",[inactive]);
await db.exec("alter table coin_transactions add constraint force_failure check(amount < 1000) not valid");
await db.exec("update survival_tactical_badge_rules set coins=1000");
await assert.rejects(award(inactive, sessions.inactive), /force_failure/);
assert.equal((await db.query("select count(*)::int as n from student_badges where student_id=$1",[inactive])).rows[0].n,0);
assert.equal((await db.query("select count(*)::int as n from student_wallets where student_id=$1",[inactive])).rows[0].n,0);
for (const role of ['anon','authenticated']) {
  assert.equal((await db.query("select has_function_privilege($1,'award_survival_tactical_badges(uuid)','execute') as allowed",[role])).rows[0].allowed,false);
  assert.equal((await db.query("select has_function_privilege($1,'award_survival_tactical_badges(uuid,uuid)','execute') as allowed",[role])).rows[0].allowed,false);
}
await db.close();
console.log("PASS: focused single-round thresholds, hint exclusion, exact coins, distinct solves, theme isolation, mixed/other modes, retries, inactive students, rollback, and role permissions.");
