-- A hint may help a student finish a Survival puzzle, but that puzzle is not
-- part of the tactic badge score. Other hint-free solves in the same focused
-- round remain eligible.
create or replace function public.award_survival_tactical_badges(
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
  perform pg_advisory_xact_lock_shared(hashtextextended('survival-badge-reset', 0));
  if to_regclass('public.badge_progress_resets') is not null then
    execute 'select reset_at, reset_key from public.badge_progress_resets order by reset_at desc limit 1'
      into v_reset_at, v_reset_key;
  end if;

  perform pg_advisory_xact_lock(hashtextextended('survival-badges:' || p_student_id::text, 0));

  if not exists (
    select 1 from public.students
    where id = p_student_id and is_active
  ) then
    return rewards;
  end if;

  -- Determine the selected theme from the whole round, but count only unique,
  -- solved puzzles completed without a hint.
  select
    min(a.selected_theme),
    count(distinct a.puzzle_id) filter (where a.solved and a.hints_used = 0)::integer
    into v_selected_theme, v_round_score
  from public.student_puzzle_attempts a
  where a.student_id = p_student_id
    and a.session_id = p_session_id
    and a.training_mode = 'survival'
    and (v_reset_at is null or a.attempted_at >= v_reset_at)
  having count(distinct a.selected_theme) = 1
    and min(a.selected_theme) <> 'mixed';

  if v_selected_theme is null or coalesce(v_round_score, 0) = 0 then
    return rewards;
  end if;

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
      'Focused Survival round: ' || v_round_score || ' hint-free '
        || lower(milestone.tactic_theme) || ' puzzles solved. +'
        || milestone.coins || ' Academy Coins.'
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

update public.badges b
set unlock_requirement = 'Score ' || r.required_puzzles || ' hint-free puzzles in one '
  || r.tactic_theme || '-only Survival round.'
from public.survival_tactical_badge_rules r
where r.badge_id = b.id;
