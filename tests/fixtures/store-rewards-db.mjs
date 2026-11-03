import { PGlite } from "../../work/achievement-db-test/node_modules/@electric-sql/pglite/dist/index.js";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";

// Disposable PostgreSQL instance. No production credentials or network access.
export async function createStoreTestDatabase() {
  const db = new PGlite();
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create table students(id uuid primary key,is_active boolean default true,display_name text);
    create table avatar_items(id uuid primary key default gen_random_uuid(),name text not null,price integer not null,
      category text not null,unlock_type text not null,is_active boolean not null default true,
      rarity text default 'Common',asset_url text,thumbnail_url text);
    create table student_wallets(student_id uuid primary key references students(id),academy_coins integer not null check(academy_coins>=0),
      total_coins_spent integer not null default 0 check(total_coins_spent>=0),updated_at timestamptz default now());
    create table student_inventory(id uuid primary key default gen_random_uuid(),student_id uuid references students(id),item_id uuid references avatar_items(id),
      acquisition_type text check(acquisition_type in ('default','purchase','achievement','admin_grant')),unique(student_id,item_id));
    create table store_purchases(id uuid primary key default gen_random_uuid(),student_id uuid references students(id),item_id uuid references avatar_items(id),price_paid integer,unique(student_id,item_id));
    create table coin_transactions(id uuid primary key default gen_random_uuid(),student_id uuid references students(id),amount integer,
      transaction_type text,source_type text,source_id text,description text,idempotency_key text unique);
    grant all on all tables in schema public to service_role;
  `);
  await db.exec(
    readFileSync(
      "supabase/migrations/20261103105513_store_special_rewards.sql",
      "utf8",
    ),
  );
  return db;
}
export async function addStudent(db, coins = 12000) {
  const id = randomUUID();
  await db.query(
    "insert into students(id,display_name) values($1,'Explorer')",
    [id],
  );
  await db.query(
    "insert into student_wallets(student_id,academy_coins) values($1,$2)",
    [id, coins],
  );
  return id;
}
export async function buy(db, student, kind, request = randomUUID()) {
  const result = await db.query(
    "select purchase_store_reward($1,$2,$3) as receipt",
    [student, kind, request],
  );
  return result.rows[0].receipt;
}
export async function resolveCoupon(db, id, status) {
  return (
    await db.query("select resolve_free_class_reward($1,$2) as receipt", [
      id,
      status,
    ])
  ).rows[0].receipt;
}
