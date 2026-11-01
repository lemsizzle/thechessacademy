import { PGlite } from "../../work/achievement-db-test/node_modules/@electric-sql/pglite/dist/index.js";
import { readFileSync } from "node:fs";
export async function createBattleTestDatabase() {
  const db = new PGlite();
  await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
    create table students(id uuid primary key);
    grant select on students to service_role;
    create schema realtime;
    create function realtime.send(jsonb,text,text,boolean) returns void language sql as 'select';
    grant usage on schema realtime to service_role;
  `);
  await db.exec(
    readFileSync(
      "supabase/migrations/20261101103837_puzzle_battles.sql",
      "utf8",
    ),
  );
  return db;
}
