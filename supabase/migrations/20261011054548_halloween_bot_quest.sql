-- Persist assistance evidence without changing existing rewards.
alter table public.internal_chess_games add column hints_used smallint not null default 0
  check (hints_used between 0 and 1000);

-- Enable only after the matching application release; older evaluators do not
-- understand this automatically tracked seasonal quest.
insert into public.academy_quests(id,title,description,type,status,is_live,xp_reward,category,source,condition_type,time_window,required_count,approval_required,is_active,is_repeatable)
values('halloween-2026-bot-quest','Halloween Bot Hunt',
  'Automatically active for every student. Beat Pipkin Pumpkin (400), Boo the Ghost (600), Count Checkula (800), Mira Moonwitch (1000), and Grim the Werewolf (1200) once each in Play, without hints or takebacks. Finish by November 1, 2026 at 11:59 PM Bangkok time. Earn 500 XP and 500 coins once.',
  'boss','available',false,500,'Seasonal','internal_games','manual','custom',5,false,false,false);

-- Only the seasonal slice is indexed; ordinary games add no entries.
create index internal_games_halloween_2026_wins_idx
on public.internal_chess_games(player_id,opponent_id,created_at)
where opponent_type='computer' and result='win' and takeback_count=0 and hints_used=0
  and opponent_id in ('halloween-2026-pumpkin','halloween-2026-ghost','halloween-2026-vampire','halloween-2026-witch','halloween-2026-werewolf');

create function public.halloween_2026_progress(p_student_id uuid)
returns jsonb language sql stable security invoker set search_path='' as $$
  select jsonb_build_object(
    'enabled',exists(select 1 from public.academy_quests where id='halloween-2026-bot-quest' and is_active and is_live),
    'defeatedBotIds',coalesce((select jsonb_agg(distinct opponent_id) from public.internal_chess_games
      where player_id=p_student_id and opponent_type='computer' and result='win'
        and takeback_count=0 and hints_used=0
        and opponent_id in ('halloween-2026-pumpkin','halloween-2026-ghost','halloween-2026-vampire','halloween-2026-witch','halloween-2026-werewolf')
        and initial_fen='rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
        and jsonb_array_length(moves)>0
        and started_at>='2026-10-11T00:00:00+07:00'::timestamptz
        and completed_at<'2026-11-02T00:00:00+07:00'::timestamptz
        -- Server receipt time prevents backdating after the deadline.
        and created_at>='2026-10-11T00:00:00+07:00'::timestamptz
        and created_at<'2026-11-02T00:00:00+07:00'::timestamptz), '[]'::jsonb),
    'completed',exists(select 1 from public.quest_completion_events where id='halloween-2026:'||p_student_id::text and student_id=p_student_id),
    'completedAt',(select completed_at from public.quest_completion_events where id='halloween-2026:'||p_student_id::text and student_id=p_student_id)
  );
$$;
revoke all on function public.halloween_2026_progress(uuid) from public,anon,authenticated;
grant execute on function public.halloween_2026_progress(uuid) to service_role;

create function public.complete_halloween_2026_quest()
returns trigger language plpgsql security invoker set search_path='' as $$
declare progress jsonb; count_wins integer; completion_id text;
  period_start timestamptz:='2026-10-11T00:00:00+07:00';
  period_end timestamptz:='2026-11-02T00:00:00+07:00';
begin
  if new.opponent_type<>'computer' or new.result<>'win' or new.takeback_count<>0 or new.hints_used<>0
    or new.opponent_id not in ('halloween-2026-pumpkin','halloween-2026-ghost','halloween-2026-vampire','halloween-2026-witch','halloween-2026-werewolf')
    or new.created_at<period_start or new.created_at>=period_end
    or new.started_at<period_start or new.completed_at>=period_end
    or new.initial_fen<>'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
    or jsonb_array_length(new.moves)=0 then return new; end if;
  -- Serialize concurrent wins/tabs. The unique completion ID also gates XP.
  perform pg_advisory_xact_lock(hashtextextended('halloween-2026:'||new.player_id::text,0));
  progress:=public.halloween_2026_progress(new.player_id);
  if not (progress->>'enabled')::boolean or (progress->>'completed')::boolean then return new; end if;
  count_wins:=jsonb_array_length(progress->'defeatedBotIds');

  insert into public.student_quest_attempts(id,student_id,quest_id,started_at,expires_at,status)
  values('halloween-2026:'||new.player_id::text,new.player_id,'halloween-2026-bot-quest',period_start,period_end,
    case when count_wins=5 then 'completed' else 'active' end)
  on conflict(student_id,quest_id,started_at,expires_at) do update set status=excluded.status;
  insert into public.lichess_quest_progress(student_id,quest_id,source_period_start,source_period_end,current_value,required_value,completed,evidence,mode)
  values(new.player_id,'halloween-2026-bot-quest',period_start,period_end,count_wins,5,count_wins=5,
    'Distinct Halloween bot wins without hints or takebacks.','connected')
  on conflict(student_id,quest_id,source_period_start,source_period_end) do update
    set current_value=excluded.current_value,completed=excluded.completed,updated_at=now();

  if count_wins=5 then
    insert into public.quest_completion_events(id,student_id,quest_id,award_id,source,source_period_start,source_period_end,xp_awarded,evidence)
    values('halloween-2026:'||new.player_id::text,new.player_id,'halloween-2026-bot-quest','halloween-2026:'||new.player_id::text,
      'internal_games',period_start,period_end,500,'Beat all five Halloween bots without hints or takebacks.')
    on conflict(id) do nothing returning id into completion_id;
    if completion_id is not null then
      update public.students set total_xp=coalesce(total_xp,0)+500 where id=new.player_id;
      -- Existing positive-XP trigger grants exactly 500 Academy Coins.
      insert into public.xp_events(student_id,amount,reason)
      values(new.player_id,500,'Quest completed: Halloween Bot Hunt (2026)');
      insert into public.activity_events(student_id,event_type,title,description)
      values(new.player_id,'quest_completed','Halloween Bot Hunt','Earned 500 XP and 500 Academy Coins.');
    end if;
  end if;
  return new;
end $$;
revoke all on function public.complete_halloween_2026_quest() from public,anon,authenticated;
grant execute on function public.complete_halloween_2026_quest() to service_role;
create trigger complete_halloween_2026_quest after insert on public.internal_chess_games
for each row execute function public.complete_halloween_2026_quest();
