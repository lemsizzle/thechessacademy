-- New awards only; preserve existing ownership and historical rewards.
alter table public.badges drop constraint badges_tier_valid;
alter table public.badges add constraint badges_tier_valid check(tier in ('C','B','A','S','SS'));
alter table public.survival_tactical_badge_rules drop constraint survival_tactical_badge_rules_tier_check;
alter table public.survival_tactical_badge_rules add constraint survival_tactical_badge_rules_tier_check check(tier in ('C','B','A','S','SS'));
alter table public.student_badges add column survival_xp_event_id uuid references public.xp_events(id) on delete set null;
create index student_badges_survival_xp_event_idx on public.student_badges(survival_xp_event_id) where survival_xp_event_id is not null;
update public.survival_tactical_badge_rules set coins=500 where tier='S';
update public.badges b set xp_value=500, unlock_requirement='Solve 40 different puzzles without hints in one '||case when r.selected_theme='mixed' then 'Mixed Themes' else r.tactic_theme end||' Survival round. Earn 500 XP and 500 Academy Coins once.'
from public.survival_tactical_badge_rules r where b.id=r.badge_id and r.tier='S';
insert into public.badges(id,name,description,category,tier,xp_value,unlock_requirement,visual_theme,art_image_url,generation_status)
values('ada00000-0000-4000-8000-000000000050','Survival: Adamantium','A score of fifty. An achievement of extraordinary endurance.','Boss Achievements','SS',1000,'Solve 50 different puzzles without hints in one Survival round, in any theme or variant. Earn 1,000 XP and 1,000 Academy Coins once.','Adamantium Survival medal (placeholder artwork)','/badges/survival-adamantium-placeholder.svg','selected');
insert into public.survival_tactical_badge_rules(tactic_theme,tier,badge_id,puzzle_themes,required_puzzles,coins,selected_theme)
values('Any Survival','SS','ada00000-0000-4000-8000-000000000050',array[]::text[],50,1000,'*');

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
  reward_event uuid;
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
    select r.*, b.name, case when r.tier in ('S','SS') then b.xp_value else 0 end as reward_xp
    from public.survival_tactical_badge_rules r
    join public.badges b on b.id = r.badge_id
    where (r.selected_theme = v_selected_theme or r.selected_theme = '*')
      and v_round_score >= r.required_puzzles
      -- Reject resumed pre-launch rounds as well as historical solves.
      and (r.selected_theme not in ('mixed','*') or not exists (
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
      if milestone.reward_xp > 0 then
        update public.students set total_xp=coalesce(total_xp,0)+milestone.reward_xp where id=p_student_id;
        insert into public.xp_events(student_id,amount,reason) values(p_student_id,milestone.reward_xp,'Survival badge: '||milestone.name) returning id into reward_event;
        update public.student_badges set survival_xp_event_id=reward_event where id=award_id;
      end if;
      -- Positive XP grants matching coins through the existing XP trigger.
      if milestone.coins > milestone.reward_xp then
      perform public.grant_academy_coins(
        p_student_id,
        milestone.coins - milestone.reward_xp,
        'earn',
        'survival_badge',
        milestone.badge_id::text,
        'Survival badge: ' || milestone.name,
        'survival-badge:' || p_student_id::text || ':' || milestone.tactic_theme || ':' || milestone.tier
          || case when v_reset_key is null then '' else ':epoch:' || v_reset_key end
      );
      end if;
      rewards := rewards || jsonb_build_array(jsonb_build_object(
        'badgeId', milestone.badge_id,
        'name', milestone.name,
        'tier', case milestone.tier
          when 'C' then 'Bronze'
          when 'B' then 'Silver'
          when 'A' then 'Gold'
          when 'SS' then 'Adamantium'
          else 'Platinum'
        end,
        'xp', milestone.reward_xp,
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
      coalesce(x.amount,0) as xp,
      coalesce((
        select sum(c.amount) from public.coin_transactions c
        where c.student_id = sb.student_id and ((c.source_type = 'survival_badge' and c.source_id = sb.badge_id::text) or c.idempotency_key='xp_event:'||sb.survival_xp_event_id::text) and c.created_at >= sb.awarded_at
      ), 0) as coins
    from public.student_badges sb
    join public.badges b on b.id = sb.badge_id
    left join public.xp_events x on x.id=sb.survival_xp_event_id
    where sb.student_id = p_student_id and sb.survival_session_id = p_session_id
  )
  select jsonb_build_object(
    'xp', coalesce((select sum(xp_amount) from puzzle_rewards), 0) + coalesce((select sum(xp) from round_badges),0),
    'puzzleCoins', coalesce((select sum(coins) from puzzle_rewards), 0),
    'badgeCoins', coalesce((select sum(coins) from round_badges), 0),
    'badges', coalesce((select jsonb_agg(jsonb_build_object(
      'badgeId', id, 'name', name, 'tier', tier, 'category', category,
      'imageUrl', image_url, 'coins', coins, 'xp', xp
    ) order by awarded_at, name) from round_badges), '[]'::jsonb)
  );
$$;
revoke all on function public.get_survival_round_rewards(uuid, uuid) from public, anon, authenticated;
grant execute on function public.get_survival_round_rewards(uuid, uuid) to service_role;
