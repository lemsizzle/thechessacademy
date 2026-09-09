-- Chaos Mastery: new Mixed Themes Survival rounds only; no historical backfill.
insert into public.badges (id, name, description, category, tier, xp_value, unlock_requirement, visual_theme, generation_status)
values
('c4a05a00-0000-4000-8000-000000000001', 'Chaos Mastery: Bronze', 'Master unpredictable combinations of chess tactics in Mixed Themes Survival.', 'Tactics', 'C', 0, 'Solve 10 different puzzles without hints in one new Mixed Themes Survival round. Earn 20 Academy Coins once.', 'Shonen chess emblem, bronze Chaos Mastery', 'pending'),
('c4a05a00-0000-4000-8000-000000000002', 'Chaos Mastery: Silver', 'Master unpredictable combinations of chess tactics in Mixed Themes Survival.', 'Tactics', 'B', 0, 'Solve 20 different puzzles without hints in one new Mixed Themes Survival round. Earn 40 Academy Coins once.', 'Shonen chess emblem, silver Chaos Mastery', 'pending'),
('c4a05a00-0000-4000-8000-000000000003', 'Chaos Mastery: Gold', 'Master unpredictable combinations of chess tactics in Mixed Themes Survival.', 'Tactics', 'A', 0, 'Solve 30 different puzzles without hints in one new Mixed Themes Survival round. Earn 100 Academy Coins once.', 'Shonen chess emblem, gold Chaos Mastery', 'pending'),
('c4a05a00-0000-4000-8000-000000000004', 'Chaos Mastery: Platinum', 'Master unpredictable combinations of chess tactics in Mixed Themes Survival.', 'Tactics', 'S', 0, 'Solve 40 different puzzles without hints in one new Mixed Themes Survival round. Earn 200 Academy Coins once.', 'Shonen chess emblem, platinum Chaos Mastery', 'pending')
on conflict (id) do nothing;

insert into public.survival_tactical_badge_rules (tactic_theme, tier, badge_id, puzzle_themes, required_puzzles, coins, selected_theme)
values
('Mixed Themes', 'C', 'c4a05a00-0000-4000-8000-000000000001', array[]::text[], 10, 20, 'mixed'),
('Mixed Themes', 'B', 'c4a05a00-0000-4000-8000-000000000002', array[]::text[], 20, 40, 'mixed'),
('Mixed Themes', 'A', 'c4a05a00-0000-4000-8000-000000000003', array[]::text[], 30, 100, 'mixed'),
('Mixed Themes', 'S', 'c4a05a00-0000-4000-8000-000000000004', array[]::text[], 40, 200, 'mixed')
on conflict (tactic_theme, tier) do nothing;

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
  having count(distinct a.selected_theme) = 1;

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
      -- Reject resumed pre-launch rounds as well as historical solves.
      and (v_selected_theme <> 'mixed' or not exists (
        select 1 from public.student_puzzle_attempts old
        where old.student_id = p_student_id and old.session_id = p_session_id
          and old.training_mode = 'survival' and old.attempted_at < b.created_at
      ))
      and not exists (
        select 1 from public.student_badges sb
        where sb.student_id = p_student_id and sb.badge_id = r.badge_id
      )
    order by r.required_puzzles
  loop
    award_id := null;
    insert into public.student_badges (student_id, badge_id, survival_session_id, note)
    values (
      p_student_id,
      milestone.badge_id,
      p_session_id,
      case when v_selected_theme = 'mixed' then 'Mixed Themes Survival round: ' else 'Focused Survival round: ' end || v_round_score || ' hint-free '
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
