-- Phase 13: durable, server-owned mistake review with spaced repetition.
-- Student identity comes from the application's verified Lichess session, so
-- browser database roles intentionally receive no table or function access.

create extension if not exists pgcrypto;

create table if not exists public.adaptive_review_items (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  source_game_id uuid not null references public.internal_chess_games(id) on delete cascade,
  source_ply integer not null,
  move_number integer not null,
  color text not null,
  fen text not null,
  played_move_san text not null,
  played_move_uci text not null,
  best_move_san text not null,
  best_move_uci text not null,
  accepted_moves_uci text[] not null,
  best_line_san text not null default '',
  explanation text not null,
  solution_explanation text not null,
  centipawn_loss integer not null,
  severity text not null,
  status text not null default 'learning',
  is_active boolean not null default true,
  repetitions integer not null default 0,
  interval_days integer not null default 0,
  ease_factor numeric(4,2) not null default 2.20,
  lapses integer not null default 0,
  attempt_count integer not null default 0,
  correct_count integer not null default 0,
  last_outcome text,
  last_reviewed_at timestamptz,
  next_review_at timestamptz not null default now(),
  mastered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint adaptive_review_source_ply_valid check (source_ply > 0),
  constraint adaptive_review_move_number_valid check (move_number > 0),
  constraint adaptive_review_color_valid check (color in ('white', 'black')),
  constraint adaptive_review_moves_present check (cardinality(accepted_moves_uci) between 1 and 12),
  constraint adaptive_review_centipawn_loss_valid check (centipawn_loss >= 0),
  constraint adaptive_review_severity_valid check (severity in ('mistake', 'blunder')),
  constraint adaptive_review_status_valid check (status in ('learning', 'review', 'mastered')),
  constraint adaptive_review_last_outcome_valid check (last_outcome is null or last_outcome in ('correct', 'incorrect', 'revealed')),
  constraint adaptive_review_counts_valid check (
    repetitions >= 0 and interval_days >= 0 and lapses >= 0 and
    attempt_count >= 0 and correct_count >= 0 and correct_count <= attempt_count
  ),
  constraint adaptive_review_ease_valid check (ease_factor between 1.30 and 3.00),
  unique (student_id, source_game_id, source_ply)
);

create table if not exists public.adaptive_review_attempts (
  id uuid primary key default gen_random_uuid(),
  review_item_id uuid not null references public.adaptive_review_items(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  outcome text not null,
  attempted_move_uci text,
  response_ms integer,
  attempted_at timestamptz not null default now(),
  constraint adaptive_review_attempt_outcome_valid check (outcome in ('correct', 'incorrect', 'revealed')),
  constraint adaptive_review_attempt_response_valid check (response_ms is null or response_ms between 0 and 3600000)
);

create index if not exists adaptive_review_items_student_due_idx
  on public.adaptive_review_items(student_id, is_active, next_review_at);
create index if not exists adaptive_review_items_student_status_idx
  on public.adaptive_review_items(student_id, status, updated_at desc);
create index if not exists adaptive_review_items_source_game_idx
  on public.adaptive_review_items(source_game_id);
create index if not exists adaptive_review_attempts_student_time_idx
  on public.adaptive_review_attempts(student_id, attempted_at desc);
create index if not exists adaptive_review_attempts_item_time_idx
  on public.adaptive_review_attempts(review_item_id, attempted_at desc);

create or replace function public.set_adaptive_review_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_adaptive_review_items_updated_at on public.adaptive_review_items;
create trigger set_adaptive_review_items_updated_at
before update on public.adaptive_review_items
for each row execute function public.set_adaptive_review_updated_at();

create or replace function public.record_adaptive_review_attempt(
  p_student_id uuid,
  p_review_item_id uuid,
  p_outcome text,
  p_attempted_move_uci text default null,
  p_response_ms integer default null
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_item public.adaptive_review_items%rowtype;
  v_repetitions integer;
  v_interval integer;
  v_status text;
  v_next_review timestamptz;
  v_now timestamptz := now();
begin
  if p_outcome not in ('correct', 'incorrect', 'revealed') then
    raise exception 'Invalid review outcome.';
  end if;
  if p_response_ms is not null and (p_response_ms < 0 or p_response_ms > 3600000) then
    raise exception 'Invalid response time.';
  end if;

  select * into v_item
  from public.adaptive_review_items
  where id = p_review_item_id and student_id = p_student_id and is_active = true
  for update;
  if not found then raise exception 'Review item not found.'; end if;

  if p_outcome = 'correct' then
    v_repetitions := v_item.repetitions + 1;
    v_interval := case v_repetitions
      when 1 then 1
      when 2 then 3
      when 3 then 7
      when 4 then 14
      else least(180, greatest(15, round(v_item.interval_days * v_item.ease_factor)::integer))
    end;
    v_status := case when v_repetitions >= 4 then 'mastered' else 'review' end;
    v_next_review := v_now + make_interval(days => v_interval);
  else
    v_repetitions := 0;
    v_interval := 0;
    v_status := 'learning';
    v_next_review := v_now + case when p_outcome = 'revealed' then interval '1 day' else interval '10 minutes' end;
  end if;

  insert into public.adaptive_review_attempts(
    review_item_id, student_id, outcome, attempted_move_uci, response_ms, attempted_at
  ) values (
    p_review_item_id, p_student_id, p_outcome, nullif(trim(p_attempted_move_uci), ''), p_response_ms, v_now
  );

  update public.adaptive_review_items
  set repetitions = v_repetitions,
      interval_days = v_interval,
      status = v_status,
      lapses = lapses + case when p_outcome = 'correct' then 0 else 1 end,
      attempt_count = attempt_count + 1,
      correct_count = correct_count + case when p_outcome = 'correct' then 1 else 0 end,
      last_outcome = p_outcome,
      last_reviewed_at = v_now,
      next_review_at = v_next_review,
      mastered_at = case when v_status = 'mastered' then coalesce(mastered_at, v_now) else null end
  where id = p_review_item_id
  returning * into v_item;

  return jsonb_build_object(
    'status', v_item.status,
    'repetitions', v_item.repetitions,
    'intervalDays', v_item.interval_days,
    'nextReviewAt', v_item.next_review_at,
    'attemptCount', v_item.attempt_count,
    'correctCount', v_item.correct_count
  );
end;
$$;

alter table public.adaptive_review_items enable row level security;
alter table public.adaptive_review_attempts enable row level security;

revoke all on table public.adaptive_review_items from public, anon, authenticated, service_role;
revoke all on table public.adaptive_review_attempts from public, anon, authenticated, service_role;
grant select, insert, update, delete on table public.adaptive_review_items to service_role;
grant select, insert, update, delete on table public.adaptive_review_attempts to service_role;

drop policy if exists "Adaptive review items are server-only" on public.adaptive_review_items;
create policy "Adaptive review items are server-only"
on public.adaptive_review_items for all to anon, authenticated
using (false) with check (false);

drop policy if exists "Adaptive review attempts are server-only" on public.adaptive_review_attempts;
create policy "Adaptive review attempts are server-only"
on public.adaptive_review_attempts for all to anon, authenticated
using (false) with check (false);

revoke all on function public.record_adaptive_review_attempt(uuid, uuid, text, text, integer) from public, anon, authenticated, service_role;
grant execute on function public.record_adaptive_review_attempt(uuid, uuid, text, text, integer) to service_role;

comment on table public.adaptive_review_items is
  'Private game-mistake positions scheduled for each student with spaced repetition.';
comment on table public.adaptive_review_attempts is
  'Immutable server-verified attempts from the adaptive mistake-review queue.';
