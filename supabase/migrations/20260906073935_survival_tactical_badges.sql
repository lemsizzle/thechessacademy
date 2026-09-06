-- Server-only rules: rewards are coins, independent of legacy teacher-awarded XP.
create table public.survival_tactical_badge_rules (
  tactic_theme text not null,
  tier text not null check (tier in ('C', 'B', 'A', 'S')),
  badge_id uuid not null unique references public.badges(id) on delete cascade,
  puzzle_themes text[] not null,
  required_puzzles integer not null check (required_puzzles > 0),
  coins integer not null check (coins > 0),
  primary key (tactic_theme, tier)
);
alter table public.survival_tactical_badge_rules enable row level security;
revoke all on public.survival_tactical_badge_rules from public, anon, authenticated;
grant select on public.survival_tactical_badge_rules to service_role;

-- Reuse existing definitions/artwork, and complete each supported tactic's set.
do $$
declare
  tactic record;
  milestone record;
  chosen_id uuid;
begin
  for tactic in select * from (values
    ('Fork', array['fork']), ('Pin', array['pin']), ('Skewer', array['skewer']),
    ('Discovered Attack', array['discoveredAttack']), ('Double Attack', array['fork', 'doubleCheck']),
    ('Deflection', array['deflection']), ('Decoy', array['attraction']),
    ('Removing the Defender', array['capturingDefender']), ('Back Rank Mate', array['backRankMate']),
    ('Mate in One', array['mateIn1'])
  ) as tactics(name, themes) loop
    for milestone in select * from (values
      ('C', 'Bronze', 10, 20), ('B', 'Silver', 20, 40),
      ('A', 'Gold', 30, 100), ('S', 'Platinum', 40, 200)
    ) as tiers(tier, label, puzzles, coins) loop
      chosen_id := null;
      select b.id into chosen_id from public.badges b
      where b.category in ('Tactics', 'Checkmates') and b.tier = milestone.tier
        and (lower(b.name) = lower(tactic.name) or lower(b.name) like lower(tactic.name) || ' %')
      order by b.created_at, b.id limit 1;

      if chosen_id is null then
        insert into public.badges (name, description, category, tier, xp_value, unlock_requirement, visual_theme, art_image_url, final_image_url, generation_status)
        select tactic.name || ' ' || milestone.label,
          'Build mastery of ' || lower(tactic.name) || ' through Survival puzzles.',
          'Tactics', milestone.tier, 0,
          'Solve ' || milestone.puzzles || ' different ' || lower(tactic.name) || ' puzzles in Survival.',
          'Magical chess academy ' || lower(tactic.name) || ' emblem',
          art.art_image_url, art.final_image_url,
          case when coalesce(art.final_image_url, art.art_image_url) is null then 'pending' else 'selected' end
        from (select 1) seed left join lateral (
          select b.art_image_url, b.final_image_url from public.badges b
          where b.category in ('Tactics', 'Checkmates')
            and (lower(b.name) = lower(tactic.name) or lower(b.name) like lower(tactic.name) || ' %')
            and coalesce(b.final_image_url, b.art_image_url) is not null
          order by b.created_at, b.id limit 1
        ) art on true returning id into chosen_id;
      else
        update public.badges set unlock_requirement =
          'Solve ' || milestone.puzzles || ' different ' || lower(tactic.name) || ' puzzles in Survival.'
        where id = chosen_id;
      end if;
      insert into public.survival_tactical_badge_rules values
        (tactic.name, milestone.tier, chosen_id, tactic.themes, milestone.puzzles, milestone.coins);
    end loop;
  end loop;
end;
$$;

create index student_survival_solved_badge_progress_idx
  on public.student_puzzle_attempts (student_id, puzzle_id)
  where training_mode = 'survival' and solved;

create or replace function public.award_survival_tactical_badges(p_student_id uuid)
returns jsonb
language plpgsql security invoker set search_path = ''
as $$
declare
  milestone record;
  award_id uuid;
  rewards jsonb := '[]'::jsonb;
begin
  -- Serializes requests from retries or multiple tabs before reading progress/awards.
  perform pg_advisory_xact_lock(hashtextextended('survival-badges:' || p_student_id::text, 0));
  if not exists (select 1 from public.students where id = p_student_id and is_active) then
    return rewards;
  end if;

  for milestone in
    with solved_puzzles as materialized (
      select distinct a.puzzle_id, p.themes from public.student_puzzle_attempts a
      join public.chess_puzzles p on p.id = a.puzzle_id
      where a.student_id = p_student_id and a.training_mode = 'survival' and a.solved
    ), progress as (
      select r.tactic_theme, count(distinct s.puzzle_id) as solved
      from (select distinct tactic_theme, puzzle_themes from public.survival_tactical_badge_rules) r
      join solved_puzzles s on s.themes && r.puzzle_themes
      group by r.tactic_theme
    )
    select r.*, b.name from public.survival_tactical_badge_rules r
    join progress p on p.tactic_theme = r.tactic_theme and p.solved >= r.required_puzzles
    join public.badges b on b.id = r.badge_id
    where not exists (select 1 from public.student_badges sb where sb.student_id = p_student_id and sb.badge_id = r.badge_id)
    order by r.tactic_theme, r.required_puzzles
  loop
    award_id := null;
    insert into public.student_badges (student_id, badge_id, note)
    values (p_student_id, milestone.badge_id,
      'Survival: ' || milestone.required_puzzles || ' different ' || lower(milestone.tactic_theme) || ' puzzles solved. +' || milestone.coins || ' Academy Coins.')
    on conflict (student_id, badge_id) do nothing returning id into award_id;
    if award_id is not null then
      perform public.grant_academy_coins(p_student_id, milestone.coins, 'earn', 'survival_badge', milestone.badge_id::text,
        'Survival badge: ' || milestone.name,
        'survival-badge:' || p_student_id::text || ':' || milestone.tactic_theme || ':' || milestone.tier);
      rewards := rewards || jsonb_build_array(jsonb_build_object(
        'badgeId', milestone.badge_id, 'name', milestone.name,
        'tier', case milestone.tier when 'C' then 'Bronze' when 'B' then 'Silver' when 'A' then 'Gold' else 'Platinum' end,
        'coins', milestone.coins));
    end if;
  end loop;
  return rewards;
end;
$$;
revoke all on function public.award_survival_tactical_badges(uuid) from public, anon, authenticated;
grant execute on function public.award_survival_tactical_badges(uuid) to service_role;
