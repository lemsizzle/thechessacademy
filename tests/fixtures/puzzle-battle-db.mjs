import { PGlite } from "../../work/achievement-db-test/node_modules/@electric-sql/pglite/dist/index.js";
import { readFileSync } from "node:fs";
export async function createBattleTestDatabase() {
  const db = new PGlite();
  await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
    create table students(id uuid primary key,is_active boolean default true,lichess_id text,lichess_username text);
    create table student_login_credentials(student_id uuid,username text);
    create table student_registration_accounts(student_id uuid,auth_user_id uuid);
    create function verify_registered_student(p_student_id uuid,p_auth_user_id uuid) returns boolean language sql as 'select exists(select 1 from public.student_registration_accounts where student_id=p_student_id and auth_user_id=p_auth_user_id)';
    grant select on students,student_login_credentials,student_registration_accounts to service_role;
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
  await db.exec(
    readFileSync(
      "supabase/migrations/20261101171608_puzzle_battle_fast_actions.sql",
      "utf8",
    ),
  );
  return db;
}
