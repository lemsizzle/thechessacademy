-- Attribute newly earned badges to their round; do not guess historical rounds.
alter table public.student_badges add column if not exists survival_session_id uuid;
create index if not exists student_badges_survival_session_idx
  on public.student_badges (student_id, survival_session_id)
  where survival_session_id is not null;

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
    insert into public.student_badges (student_id, badge_id, survival_session_id, note)
    values (
      p_student_id,
      milestone.badge_id,
      p_session_id,
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

 

-- Read-only, service-role-only snapshot. The API supplies the signed-in student.
create or replace function public.get_survival_round_rewards(p_student_id uuid, p_session_id uuid)
returns jsonb
language sql stable security invoker set search_path = ''
as $$
  with puzzle_rewards as (
    select r.xp_amount,
      coalesce(c.amount, 0) as coins
    from public.student_puzzle_attempts a
    join public.academy_activity_rewards r
      on r.student_id = a.student_id and r.source_type = 'web_puzzle' and r.source_id = a.id
    left join public.coin_transactions c
      on c.student_id = r.student_id and c.idempotency_key = 'xp_event:' || r.xp_event_id::text
    where a.student_id = p_student_id and a.session_id = p_session_id and a.training_mode = 'survival'
  ), round_badges as (
    select b.id, b.name, b.tier, b.category,
      coalesce(nullif(b.final_image_url, ''), nullif(b.art_image_url, '')) as image_url,
      sb.awarded_at,
      coalesce((
        select sum(c.amount) from public.coin_transactions c
        where c.student_id = sb.student_id and c.source_type = 'survival_badge'
          and c.source_id = sb.badge_id::text and c.created_at >= sb.awarded_at
      ), 0) as coins
    from public.student_badges sb
    join public.badges b on b.id = sb.badge_id
    where sb.student_id = p_student_id and sb.survival_session_id = p_session_id
  )
  select jsonb_build_object(
    'xp', coalesce((select sum(xp_amount) from puzzle_rewards), 0),
    'puzzleCoins', coalesce((select sum(coins) from puzzle_rewards), 0),
    'badgeCoins', coalesce((select sum(coins) from round_badges), 0),
    'badges', coalesce((select jsonb_agg(jsonb_build_object(
      'badgeId', id, 'name', name, 'tier', tier, 'category', category,
      'imageUrl', image_url, 'coins', coins
    ) order by awarded_at, name) from round_badges), '[]'::jsonb)
  );
$$;
revoke all on function public.get_survival_round_rewards(uuid, uuid) from public, anon, authenticated;
grant execute on function public.get_survival_round_rewards(uuid, uuid) to service_role;
