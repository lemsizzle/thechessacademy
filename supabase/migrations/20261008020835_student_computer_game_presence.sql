-- One bounded snapshot per student; finished games and rewards use their existing systems.
create table if not exists public.student_computer_game_presence (
  student_id uuid primary key references public.students(id) on delete cascade,
  game_id uuid not null unique,
  version integer not null check (version > 0),
  status text not null check (status in ('active', 'completed', 'closed')),
  bot_id text not null,
  human_color text not null check (human_color in ('white', 'black')),
  time_control_id text not null,
  move_count integer not null check (move_count between 0 and 1200),
  started_at timestamptz not null,
  updated_at timestamptz not null default now(),
  snapshot jsonb not null check (jsonb_typeof(snapshot->'moves') = 'array' and octet_length(snapshot::text) <= 20000)
);

create index if not exists student_computer_game_presence_active_idx
  on public.student_computer_game_presence (updated_at desc) where status = 'active';
alter table public.student_computer_game_presence enable row level security;
revoke all on public.student_computer_game_presence from public, anon, authenticated;
grant select, insert, update, delete on public.student_computer_game_presence to service_role;

-- Atomic version/session guards prevent a delayed heartbeat or tab cleanup replacing newer play.
create or replace function public.publish_student_computer_game(
  p_student_id uuid, p_game_id uuid, p_version integer, p_status text,
  p_bot_id text, p_human_color text, p_time_control_id text,
  p_started_at timestamptz, p_snapshot jsonb
) returns boolean
language plpgsql security invoker set search_path = public, pg_temp as $$
declare affected integer;
begin
  insert into public.student_computer_game_presence as existing (
    student_id, game_id, version, status, bot_id, human_color, time_control_id,
    move_count, started_at, updated_at, snapshot
  ) values (
    p_student_id, p_game_id, p_version, p_status, p_bot_id, p_human_color, p_time_control_id,
    jsonb_array_length(p_snapshot->'moves'), p_started_at, clock_timestamp(), p_snapshot
  )
  on conflict (student_id) do update set
    game_id = excluded.game_id, version = excluded.version, status = excluded.status,
    bot_id = excluded.bot_id, human_color = excluded.human_color, time_control_id = excluded.time_control_id,
    move_count = excluded.move_count, started_at = excluded.started_at,
    updated_at = excluded.updated_at, snapshot = excluded.snapshot
  where (
    existing.game_id = excluded.game_id and excluded.version > existing.version
    and (existing.status = 'active' or excluded.status = existing.status)
    and existing.bot_id = excluded.bot_id and existing.human_color = excluded.human_color
    and existing.time_control_id = excluded.time_control_id and existing.started_at = excluded.started_at
  ) or (existing.game_id <> excluded.game_id and excluded.started_at > existing.started_at);
  get diagnostics affected = row_count;
  return affected > 0;
end;
$$;

revoke all on function public.publish_student_computer_game(uuid, uuid, integer, text, text, text, text, timestamptz, jsonb) from public, anon, authenticated;
grant execute on function public.publish_student_computer_game(uuid, uuid, integer, text, text, text, text, timestamptz, jsonb) to service_role;
