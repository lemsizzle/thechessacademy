-- Tactic badges measure one focused Survival round. Cumulative progress and
-- mixed-theme sessions are intentionally ineligible.
alter table public.survival_tactical_badge_rules
  add column selected_theme text;

update public.survival_tactical_badge_rules
set selected_theme = case tactic_theme
  when 'Fork' then 'fork'
  when 'Pin' then 'pin'
  when 'Skewer' then 'skewer'
  when 'Discovered Attack' then 'discoveredAttack'
  when 'Double Attack' then 'doubleCheck'
  when 'Deflection' then 'deflection'
  when 'Decoy' then 'attraction'
  when 'Removing the Defender' then 'capturingDefender'
  when 'Back Rank Mate' then 'backRankMate'
  when 'Mate in One' then 'mateIn1'
end;

alter table public.survival_tactical_badge_rules
  alter column selected_theme set not null;

create unique index survival_tactical_badge_rules_selected_theme_tier_idx
  on public.survival_tactical_badge_rules (selected_theme, tier);

update public.badges b
set unlock_requirement = 'Score ' || r.required_puzzles || ' in one '
  || r.tactic_theme || '-only Survival round.'
from public.survival_tactical_badge_rules r
where r.badge_id = b.id;

-- Keep stale deployed clients safe during rollout. They only know the old
-- student-only signature, so route it to the student's most recent focused
-- round instead of evaluating cumulative history.
create or replace function public.award_survival_tactical_badges(p_student_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_session_id uuid;
begin
  select a.session_id into v_session_id
  from public.student_puzzle_attempts a
  where a.student_id = p_student_id
    and a.training_mode = 'survival'
    and a.solved
    and a.selected_theme <> 'mixed'
  order by coalesce(a.completed_at, a.attempted_at) desc, a.id desc
  limit 1;

  if v_session_id is null then
    return '[]'::jsonb;
  end if;
  return public.award_survival_tactical_badges(p_student_id, v_session_id);
end;
$$;
revoke all on function public.award_survival_tactical_badges(uuid)
  from public, anon, authenticated;
grant execute on function public.award_survival_tactical_badges(uuid)
  to service_role;

create function public.award_survival_tactical_badges(
  p_student_id uuid,
  p_session_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  milestone record;
  v_reset_at timestamptz;
  v_reset_key text;
  v_selected_theme text;
  v_round_score integer;
  award_id uuid;
  rewards jsonb := '[]'::jsonb;
begin
  -- Resets take the exclusive counterpart; normal awards can run concurrently.
  perform pg_advisory_xact_lock_shared(hashtextextended('survival-badge-reset', 0));
  -- The reset support migration may be deployed separately. Read it when
  -- present without making this focused-round rule depend on that operation.
  if to_regclass('public.badge_progress_resets') is not null then
    execute 'select reset_at, reset_key from public.badge_progress_resets order by reset_at desc limit 1'
      into v_reset_at, v_reset_key;
  end if;

  -- Serialize retries from this student before checking ownership and rewards.
  perform pg_advisory_xact_lock(hashtextextended('survival-badges:' || p_student_id::text, 0));

  if not exists (
    select 1 from public.students
    where id = p_student_id and is_active
  ) then
    return rewards;
  end if;

  -- A valid badge run has one explicitly selected, non-mixed theme. The score
  -- is the number of different puzzles solved in this one Survival session.
  select min(a.selected_theme), count(distinct a.puzzle_id)::integer
    into v_selected_theme, v_round_score
  from public.student_puzzle_attempts a
  where a.student_id = p_student_id
    and a.session_id = p_session_id
    and a.training_mode = 'survival'
    and a.solved
    and (v_reset_at is null or a.attempted_at >= v_reset_at)
  having count(distinct a.selected_theme) = 1
    and min(a.selected_theme) <> 'mixed';

  if v_selected_theme is null or coalesce(v_round_score, 0) = 0 then
    return rewards;
  end if;

  -- Reject a malformed session even if its solved rows happen to share a theme.
  if exists (
    select 1 from public.student_puzzle_attempts a
    where a.student_id = p_student_id
      and a.session_id = p_session_id
      and a.training_mode = 'survival'
      and a.selected_theme <> v_selected_theme
  ) then
    return rewards;
  end if;

  for milestone in
    select r.*, b.name
    from public.survival_tactical_badge_rules r
    join public.badges b on b.id = r.badge_id
    where r.selected_theme = v_selected_theme
      and v_round_score >= r.required_puzzles
      and not exists (
        select 1 from public.student_badges sb
        where sb.student_id = p_student_id and sb.badge_id = r.badge_id
      )
    order by r.required_puzzles
  loop
    award_id := null;
    insert into public.student_badges (student_id, badge_id, note)
    values (
      p_student_id,
      milestone.badge_id,
      'Focused Survival round: ' || v_round_score || ' ' || lower(milestone.tactic_theme)
        || ' puzzles solved. +' || milestone.coins || ' Academy Coins.'
    )
    on conflict (student_id, badge_id) do nothing
    returning id into award_id;

    if award_id is not null then
      perform public.grant_academy_coins(
        p_student_id,
        milestone.coins,
        'earn',
        'survival_badge',
        milestone.badge_id::text,
        'Survival badge: ' || milestone.name,
        'survival-badge:' || p_student_id::text || ':' || milestone.tactic_theme || ':' || milestone.tier
          || case when v_reset_key is null then '' else ':epoch:' || v_reset_key end
      );
      rewards := rewards || jsonb_build_array(jsonb_build_object(
        'badgeId', milestone.badge_id,
        'name', milestone.name,
        'tier', case milestone.tier
          when 'C' then 'Bronze'
          when 'B' then 'Silver'
          when 'A' then 'Gold'
          else 'Platinum'
        end,
        'coins', milestone.coins
      ));
    end if;
  end loop;

  return rewards;
end;
$$;

revoke all on function public.award_survival_tactical_badges(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.award_survival_tactical_badges(uuid, uuid)
  to service_role;
