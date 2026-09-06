// Isolated Postgres verification; never connects to the shared Supabase project.
// Usage: node scripts/verify-paper-chess-set.mjs <installed @electric-sql/pglite directory>
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import path from "node:path";
process.on("uncaughtException", (error) => { console.error(error.message); process.exit(1); });
const { PGlite } = await import(pathToFileURL(path.join(process.argv[2], "dist/index.js")).href);
const db = new PGlite();
await db.exec("create role anon; create role authenticated; create role service_role bypassrls; create table students (id uuid primary key default gen_random_uuid(), total_xp integer default 0);");
const base = await readFile("docs/supabase-avatar-system.sql", "utf8");
// The fixture has no existing students; omit the unrelated historical XP backfill.
const schema = base.slice(0, base.indexOf("-- Existing students receive an idempotent initial coin balance"))
  + base.slice(base.indexOf("-- Existing students receive default avatar items once."));
await db.exec(schema.replace("create extension if not exists pgcrypto;", ""));
const migration = await readFile("supabase/migrations/20260906084628_paper_chess_set.sql", "utf8");
await db.exec(migration);
await db.exec(migration); // Rerunning must not duplicate the item or lose inventory.
const [paper] = (await db.query("select * from avatar_items where slug='paper-chess-set'")).rows;
assert.equal(paper.category, "board_theme"); assert.equal(paper.price,800); assert.equal(paper.unlock_type,"purchase");
const student = (await db.query("insert into students default values returning id")).rows[0].id;
await db.query("insert into student_wallets(student_id,academy_coins,total_coins_earned,total_coins_spent) values ($1,799,799,0)",[student]);
await assert.rejects(db.query("select purchase_avatar_item($1,$2)",[student,paper.id]), /Not enough Academy Coins/);
assert.equal((await db.query("select count(*)::int as n from student_inventory where student_id=$1",[student])).rows[0].n,0);
await db.query("update student_wallets set academy_coins=1600, total_coins_earned=1600 where student_id=$1",[student]);
await db.query("select purchase_avatar_item($1,$2)",[student,paper.id]);
await assert.rejects(db.query("select purchase_avatar_item($1,$2)",[student,paper.id]), /already owned/);
assert.equal((await db.query("select academy_coins from student_wallets where student_id=$1",[student])).rows[0].academy_coins,800);
assert.equal((await db.query("select count(*)::int as n from store_purchases where student_id=$1",[student])).rows[0].n,1);
assert.equal((await db.query("select count(*)::int as n from student_inventory i join avatar_items a on a.id=i.item_id where i.student_id=$1 and a.category='board_theme' and a.slug='paper-chess-set'",[student])).rows[0].n,1);
assert.equal((await db.query("select count(*)::int as n from student_avatar where student_id=$1",[student])).rows[0].n,0);
for (const role of ["anon", "authenticated"]) {
  assert.equal((await db.query("select has_function_privilege($1,'purchase_avatar_item(uuid,uuid)','execute') as allowed",[role])).rows[0].allowed,false);
}
assert.equal((await db.query("select relrowsecurity from pg_class where oid='student_inventory'::regclass")).rows[0].relrowsecurity,true);
await assert.rejects(db.query("update avatar_items set category='not-a-theme' where id=$1",[paper.id]),/avatar_items_category_check/);
await db.close();
console.log("PASS: migration/replay, 800-coin purchase, insufficient funds, duplicate purchase rejection, ownership lookup, avatar isolation, RLS and service-only purchase permissions.");
