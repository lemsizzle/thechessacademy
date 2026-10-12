import { PGlite } from '../../work/achievement-db-test/node_modules/@electric-sql/pglite/dist/index.js';
import { readFileSync } from 'node:fs';
export async function createHalloweenTestDatabase() {
const db = new PGlite();
const read = path => readFileSync(path,'utf8');
await db.exec(`
create role anon; create role authenticated; create role service_role bypassrls;
create table students(id uuid primary key,total_xp integer default 0);
create table xp_events(id uuid primary key default gen_random_uuid(),student_id uuid references students(id),amount integer,reason text,created_at timestamptz default now());
create table student_wallets(student_id uuid primary key,academy_coins integer default 0,total_coins_earned integer default 0,total_coins_spent integer default 0);
create table coin_transactions(id uuid primary key default gen_random_uuid(),student_id uuid,amount integer,transaction_type text,source_type text,source_id text,description text,idempotency_key text unique);
create table academy_quests(id text primary key,title text,description text,type text,status text,is_live boolean,xp_reward integer,category text,source text,condition_type text,time_window text,required_count integer,approval_required boolean,is_active boolean,is_repeatable boolean);
create table internal_chess_games(id uuid primary key default gen_random_uuid(),player_id uuid references students(id),opponent_type text default 'computer',opponent_id text,result text default 'win',takeback_count integer default 0,initial_fen text,moves jsonb,started_at timestamptz,completed_at timestamptz,created_at timestamptz default now());
create table student_quest_attempts(id text primary key,student_id uuid,quest_id text,started_at timestamptz,expires_at timestamptz,status text,unique(student_id,quest_id,started_at,expires_at));
create table lichess_quest_progress(student_id uuid,quest_id text,source_period_start timestamptz,source_period_end timestamptz,current_value integer,required_value integer,completed boolean,evidence text,mode text,updated_at timestamptz default now(),unique(student_id,quest_id,source_period_start,source_period_end));
create table quest_completion_events(id text primary key,student_id uuid,quest_id text,award_id text,source text,source_period_start timestamptz,source_period_end timestamptz,xp_awarded integer,evidence text,completed_at timestamptz default now());
create table activity_events(student_id uuid,event_type text,title text,description text);
grant select,insert,update on all tables in schema public to service_role;
`);
await db.exec(read('tests/fixtures/training-wallet-functions.sql'));
await db.exec('create trigger award_academy_coins_after_xp_event after insert on xp_events for each row execute function award_academy_coins_for_xp_event();');
await db.exec(read('supabase/migrations/20261011054548_halloween_bot_quest.sql'));
const rollout = (await db.query("select is_active,is_live from academy_quests where id='halloween-2026-bot-quest'")).rows[0];
if (rollout.is_active || rollout.is_live) throw new Error('Seasonal quest must remain disabled until the matching app is deployed.');
await db.exec("update academy_quests set is_active=true,is_live=true where id='halloween-2026-bot-quest';");
return db;
}
