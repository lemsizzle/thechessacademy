-- Add an optional quest completion link to existing Supabase projects.
-- Safe to run after the original schema has already been applied.
-- This does not delete or change existing quest data.

alter table public.quests
add column if not exists completion_url text;

comment on column public.quests.completion_url is
  'Optional external URL where students can complete the quest, such as Lichess training or a class resource.';
