import { createHalloweenTestDatabase } from './halloween-db.mjs';
import { readFileSync } from 'node:fs';
export async function createSeasonalTestDatabase() {
  const db = await createHalloweenTestDatabase();
  await db.exec(`
    create table badges(id uuid primary key,name text,description text,category text,tier text,xp_value integer,unlock_requirement text,visual_theme text,art_image_url text,final_image_url text,generation_status text);
    create table student_badges(id uuid primary key default gen_random_uuid(),student_id uuid references students(id),badge_id uuid references badges(id),note text,achievement_evidence jsonb,awarded_at timestamptz default now(),is_displayed boolean default false,unique(student_id,badge_id));
    alter table academy_quests add column badge_reward_id text;
    alter table quest_completion_events add column badge_awarded_id text;
    grant select,insert,update on badges,student_badges to service_role;
  `);
  await db.exec(readFileSync('supabase/migrations/20261101095251_seasonal_bot_hunts.sql','utf8'));
  await db.exec(readFileSync('supabase/migrations/20261101102623_thanksgiving_quest_copy.sql','utf8'));
  const row = (await db.query("select is_active,is_live from academy_quests where id='thanksgiving-2026-bot-quest'")).rows[0];
  if (row.is_active || row.is_live) throw Error('Quest must be staged until app deployment.');
  await db.exec("update academy_quests set is_active=true,is_live=true where id='thanksgiving-2026-bot-quest';");
  return db;
}
