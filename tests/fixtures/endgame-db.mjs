import { readFileSync } from 'node:fs';
export async function installEndgameTestSchema(db) {
  await db.exec(`
    alter table students add column total_xp integer not null default 0;
    create table xp_events(id uuid primary key default gen_random_uuid(),student_id uuid references students(id),amount integer,reason text,created_at timestamptz default now());
    create table student_wallets(student_id uuid primary key,academy_coins integer default 0,total_coins_earned integer default 0,total_coins_spent integer default 0);
    create table coin_transactions(id uuid primary key default gen_random_uuid(),student_id uuid,amount integer,transaction_type text,source_type text,source_id text,description text,idempotency_key text unique);
    grant select,insert,update on students,xp_events,student_wallets,coin_transactions to service_role;
  `);
  await db.exec(readFileSync('tests/fixtures/training-wallet-functions.sql','utf8'));
  await db.exec('create trigger award_academy_coins_after_xp_event after insert on xp_events for each row execute function award_academy_coins_for_xp_event();');
  await db.exec(readFileSync('supabase/migrations/20261118123038_endgame_training_rewards.sql','utf8'));
}
