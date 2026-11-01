-- Reusable seasonal hunt definitions. Only trusted server code can read/write
-- this configuration or execute the progress function; student identity comes
-- from the application's signed session, not Supabase Auth.
create table public.seasonal_bot_hunts (
  quest_id text primary key references public.academy_quests(id),
  starts_at timestamptz not null,
  ends_at timestamptz not null check (ends_at > starts_at),
  bot_ids text[] not null check (cardinality(bot_ids) > 0),
  completion_prefix text not null unique,
  badge_id uuid references public.badges(id)
);
alter table public.seasonal_bot_hunts enable row level security;
revoke all on public.seasonal_bot_hunts from public, anon, authenticated;
grant select, insert, update, delete on public.seasonal_bot_hunts to service_role;
create index seasonal_bot_hunts_badge_idx on public.seasonal_bot_hunts(badge_id);

-- Zero additional badge XP: the hunt's single reward already grants 500 XP and
-- its existing XP-to-coin trigger grants the matching 500 coins.
insert into public.badges(id,name,description,category,tier,xp_value,unlock_requirement,visual_theme,art_image_url,final_image_url,generation_status)
values('e7261127-0000-4000-8000-000000000001','Harvest Champion',
 'Completed the 2026 Thanksgiving Bot Hunt. A golden harvest medallion for five victories.',
 'Boss Achievements','A',0,
 'Beat all five Thanksgiving bots in Play without hints or takebacks by November 27, 2026 at 11:59 PM Pacific. Automatically awarded with the hunt''s 500 XP and 500 coins; no extra badge XP.',
 'Golden autumn leaves, ivory chess king, wheat, acorns, and an amber jewel.',
 '/badges/seasonal/harvest-champion.webp','/badges/seasonal/harvest-champion.webp','selected');

-- Keep disabled until the matching application and artwork are deployed.
insert into public.academy_quests(id,title,description,type,status,is_live,xp_reward,badge_reward_id,category,source,condition_type,time_window,required_count,approval_required,is_active,is_repeatable)
values('thanksgiving-2026-bot-quest','Thanksgiving Bot Hunt',
 'Automatically active for every student. Beat Tilly Turkey (400), Kernel Corn (600), Maple Fox (800), Hazel Harvest (1000), and King Chestnut (1200) in Play without hints or takebacks. Finish by November 27, 2026 at 11:59 PM Pacific. Earn 500 XP, 500 coins, and the Harvest Champion badge once.',
 'boss','available',false,500,'e7261127-0000-4000-8000-000000000001','Seasonal','internal_games','manual','custom',5,false,false,false);
insert into public.seasonal_bot_hunts(quest_id,starts_at,ends_at,bot_ids,completion_prefix,badge_id)
values('thanksgiving-2026-bot-quest','2026-11-01T00:00:00+07:00','2026-11-28T00:00:00-08:00',
 array['thanksgiving-2026-turkey','thanksgiving-2026-corn','thanksgiving-2026-fox','thanksgiving-2026-scarecrow','thanksgiving-2026-stag'],
 'seasonal:thanksgiving-2026:','e7261127-0000-4000-8000-000000000001');

create index internal_games_seasonal_eligible_wins_idx
on public.internal_chess_games(player_id,opponent_id,created_at)
where opponent_type='computer' and result='win' and takeback_count=0 and hints_used=0;

create function public.seasonal_bot_hunt_progress(p_student_id uuid,p_quest_id text)
returns jsonb language sql stable security invoker set search_path='' as $$
  select jsonb_build_object(
    'enabled',q.is_active and q.is_live,
    'defeatedBotIds',coalesce((select jsonb_agg(distinct g.opponent_id) from public.internal_chess_games g
      where g.player_id=p_student_id and g.opponent_type='computer' and g.result='win' and g.takeback_count=0 and g.hints_used=0
        and g.opponent_id=any(h.bot_ids)
        and g.initial_fen='rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
        and jsonb_array_length(g.moves)>0
        and g.started_at>=h.starts_at and g.completed_at>=g.started_at and g.completed_at<h.ends_at
        and g.created_at>=h.starts_at and g.created_at<h.ends_at), '[]'::jsonb),
    'completed',exists(select 1 from public.quest_completion_events c where c.id=h.completion_prefix||p_student_id::text and c.student_id=p_student_id),
    'completedAt',(select c.completed_at from public.quest_completion_events c where c.id=h.completion_prefix||p_student_id::text and c.student_id=p_student_id)
  ) from public.seasonal_bot_hunts h join public.academy_quests q on q.id=h.quest_id where h.quest_id=p_quest_id;
$$;
revoke all on function public.seasonal_bot_hunt_progress(uuid,text) from public,anon,authenticated;
grant execute on function public.seasonal_bot_hunt_progress(uuid,text) to service_role;

create function public.complete_seasonal_bot_hunt()
returns trigger language plpgsql security invoker set search_path='' as $$
declare hunt record; progress jsonb; wins integer; needed integer; completion_id text; event_id text;
begin
  if new.opponent_type<>'computer' or new.result<>'win' or new.takeback_count<>0 or new.hints_used<>0
    or new.initial_fen<>'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
    or coalesce(jsonb_array_length(new.moves),0)=0 then return new; end if;
  for hunt in select h.*,q.title,q.xp_reward from public.seasonal_bot_hunts h
    join public.academy_quests q on q.id=h.quest_id
    where q.is_active and q.is_live and new.opponent_id=any(h.bot_ids)
      and new.created_at>=h.starts_at and new.created_at<h.ends_at
      and new.started_at>=h.starts_at and new.completed_at>=new.started_at and new.completed_at<h.ends_at
  loop
    event_id:=hunt.completion_prefix||new.player_id::text;
    perform pg_advisory_xact_lock(hashtextextended(event_id,0));
    progress:=public.seasonal_bot_hunt_progress(new.player_id,hunt.quest_id);
    if (progress->>'completed')::boolean then continue; end if;
    wins:=jsonb_array_length(progress->'defeatedBotIds'); needed:=cardinality(hunt.bot_ids);
    insert into public.student_quest_attempts(id,student_id,quest_id,started_at,expires_at,status)
    values(event_id,new.player_id,hunt.quest_id,hunt.starts_at,hunt.ends_at,case when wins=needed then 'completed' else 'active' end)
    on conflict(student_id,quest_id,started_at,expires_at) do update set status=excluded.status;
    insert into public.lichess_quest_progress(student_id,quest_id,source_period_start,source_period_end,current_value,required_value,completed,evidence,mode)
    values(new.player_id,hunt.quest_id,hunt.starts_at,hunt.ends_at,wins,needed,wins=needed,'Distinct seasonal bot wins without hints or takebacks.','connected')
    on conflict(student_id,quest_id,source_period_start,source_period_end) do update
      set current_value=excluded.current_value,completed=excluded.completed,updated_at=now();
    if wins=needed then
      completion_id:=null;
      insert into public.quest_completion_events(id,student_id,quest_id,award_id,source,source_period_start,source_period_end,xp_awarded,badge_awarded_id,evidence)
      values(event_id,new.player_id,hunt.quest_id,event_id,'internal_games',hunt.starts_at,hunt.ends_at,hunt.xp_reward,hunt.badge_id::text,
        'Beat every seasonal bot without hints or takebacks.')
      on conflict(id) do nothing returning id into completion_id;
      if completion_id is not null then
        if hunt.badge_id is not null then
          insert into public.student_badges(student_id,badge_id,note,achievement_evidence)
          values(new.player_id,hunt.badge_id,'Completed '||hunt.title||'.',jsonb_build_object('questId',hunt.quest_id,'completionEventId',event_id))
          on conflict(student_id,badge_id) do nothing;
        end if;
        update public.students set total_xp=coalesce(total_xp,0)+hunt.xp_reward where id=new.player_id;
        insert into public.xp_events(student_id,amount,reason) values(new.player_id,hunt.xp_reward,'Quest completed: '||hunt.title);
        insert into public.activity_events(student_id,event_type,title,description)
        values(new.player_id,'quest_completed',hunt.title,'Earned '||hunt.xp_reward||' XP and Academy Coins, plus the completion badge.');
      end if;
    end if;
  end loop;
  return new;
end $$;
revoke all on function public.complete_seasonal_bot_hunt() from public,anon,authenticated;
grant execute on function public.complete_seasonal_bot_hunt() to service_role;
create trigger complete_seasonal_bot_hunt after insert on public.internal_chess_games
for each row execute function public.complete_seasonal_bot_hunt();
