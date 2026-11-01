-- Plans are private, immutable for a match, and advance using database time.
-- No student row, background worker, or per-second request is needed for a bot.
alter table public.puzzle_battle_decks add column bot_plan jsonb;

-- Only human matches need opponent broadcasts. Bot boundaries are scheduled locally.
drop trigger puzzle_battle_changed on public.puzzle_battles;
create trigger puzzle_battle_changed after update on public.puzzle_battles
for each row when (not (new.state ? 'bot')) execute function public.notify_puzzle_battle();

create function public.create_puzzle_bot_battle(p_id uuid,p_code text,p_student_id uuid,p_mode text,p_duration integer,p_state jsonb,p_deck jsonb,p_plan jsonb,p_source_id uuid default null)
returns uuid language plpgsql security invoker set search_path='' as $$
declare source public.puzzle_battles; starts numeric; st jsonb; level text:=p_state#>>'{bot,level}';
begin
  perform pg_advisory_xact_lock(hashtextextended('puzzle-battle-player:'||p_student_id::text,0));
  if p_source_id is not null then
    select * into source from public.puzzle_battles where id=p_source_id for update;
    if source.id is null or source.host_id<>p_student_id or not (source.state?'bot') or source.state->>'status'<>'finished' then
      raise exception 'Finish your bot battle before a rematch.';
    end if;
    if source.state->>'rematchId' is not null then return (source.state->>'rematchId')::uuid; end if;
  end if;
  if level is null or level not in ('gentle','steady','swift') or p_state->>'status'<>'playing'
    or p_state#>>'{players,0,id}' is distinct from p_student_id::text
    or p_state#>>'{players,1,id}' is distinct from 'bot:'||level
    or jsonb_array_length(p_state->'players')<>2
    or jsonb_typeof(p_plan)<>'array' or jsonb_array_length(p_plan)<>jsonb_array_length(p_deck) then
    raise exception 'Invalid bot battle.';
  end if;
  starts:=floor(extract(epoch from clock_timestamp())*1000)+5000;
  st:=p_state||jsonb_build_object('startsAt',starts,'endsAt',starts+p_duration*1000,
    'bot',jsonb_build_object('level',level,'nextAt',starts+(p_plan#>>'{0,atMs}')::numeric));
  perform public.create_puzzle_battle(p_id,p_code,p_student_id,p_mode,p_duration,st,p_deck);
  update public.puzzle_battle_decks set bot_plan=p_plan where battle_id=p_id;
  if p_source_id is not null then
    update public.puzzle_battles set state=state||jsonb_build_object('rematchId',p_id),version=version+1 where id=p_source_id;
  end if;
  return p_id;
end $$;

create function public.advance_puzzle_battle_bot(p_id uuid)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare b public.puzzle_battles; st jsonb; bot jsonb; human jsonb; plan jsonb; item jsonb;
  at_time numeric; current_time_ms numeric; next_at numeric; cursor integer; solved boolean; winner text;
begin
  select * into b from public.puzzle_battles where id=p_id;
  if b.id is null then return null; end if;
  if not (b.state?'bot') or b.state->>'status'<>'playing' then return to_jsonb(b); end if;
  select * into b from public.puzzle_battles where id=p_id for update;
  if b.state->>'status'<>'playing' then return to_jsonb(b); end if;
  current_time_ms:=floor(extract(epoch from clock_timestamp())*1000);
  if current_time_ms<(b.state->>'startsAt')::numeric then return to_jsonb(b); end if;
  select bot_plan into plan from public.puzzle_battle_decks where battle_id=p_id;
  if plan is null or jsonb_array_length(plan)=0 then raise exception 'Missing bot plan.'; end if;
  st:=b.state; bot:=st#>'{players,1}'; human:=st#>'{players,0}'; cursor:=(bot->>'index')::integer;
  while not (bot->>'done')::boolean and cursor<jsonb_array_length(plan) loop
    item:=plan->cursor; at_time:=(st->>'startsAt')::numeric+(item->>'atMs')::numeric;
    exit when at_time>current_time_ms or at_time>=(st->>'endsAt')::numeric;
    solved:=(item->>'solved')::boolean;
    bot:=bot||jsonb_build_object('score',(bot->>'score')::integer+case when solved then 1 else 0 end,
      'mistakes',(bot->>'mistakes')::integer+case when solved then 0 else 1 end,
      'index',cursor+1,'revision',(bot->>'revision')::integer+1);
    cursor:=cursor+1;
    bot:=bot||jsonb_build_object('done',b.mode='hide-and-seek' or (bot->>'mistakes')::integer>=3 or cursor>=jsonb_array_length(plan));
    if b.mode='hide-and-seek' then
      st:=st||jsonb_build_object('status','finished','winnerId',case when solved then bot->>'id' else human->>'id' end);
      exit;
    end if;
  end loop;
  st:=jsonb_set(st,'{players,1}',bot);
  if st->>'status'='playing' and (current_time_ms>=(st->>'endsAt')::numeric or ((bot->>'done')::boolean and (human->>'done')::boolean)) then
    winner:=case when (human->>'score')::integer=(bot->>'score')::integer then null
      when (human->>'score')::integer>(bot->>'score')::integer then human->>'id' else bot->>'id' end;
    st:=st||jsonb_build_object('status','finished','winnerId',winner);
  end if;
  if st->>'status'='playing' and not (bot->>'done')::boolean and cursor<jsonb_array_length(plan) then
    next_at:=(st->>'startsAt')::numeric+(plan->cursor->>'atMs')::numeric;
    if next_at>=(st->>'endsAt')::numeric then next_at:=null; end if;
  end if;
  st:=jsonb_set(st,'{bot,nextAt}',coalesce(to_jsonb(next_at),'null'::jsonb));
  if st is distinct from b.state then
    update public.puzzle_battles set state=st,version=version+1 where id=p_id returning * into b;
  end if;
  return to_jsonb(b);
end $$;
revoke all on function public.create_puzzle_bot_battle(uuid,text,uuid,text,integer,jsonb,jsonb,jsonb,uuid) from public,anon,authenticated;
revoke all on function public.advance_puzzle_battle_bot(uuid) from public,anon,authenticated;
grant execute on function public.create_puzzle_bot_battle(uuid,text,uuid,text,integer,jsonb,jsonb,jsonb,uuid) to service_role;
grant execute on function public.advance_puzzle_battle_bot(uuid) to service_role;

-- Refresh scheduled bot progress before reads and human writes.
create or replace function public.load_puzzle_battle(p_id uuid,p_student_id uuid,p_identity jsonb,p_include_deck boolean default false)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare s public.students; b public.puzzle_battles; provider text:=coalesce(p_identity->>'provider','lichess'); allowed boolean:=false; result jsonb;
begin
  select * into s from public.students where id=p_student_id and is_active=true;
  if s.id is null then raise exception 'Student profile no longer exists.' using errcode='28000'; end if;
  if provider='academy' then
    allowed:=exists(select 1 from public.student_login_credentials where student_id=p_student_id and username=p_identity->>'username');
  elsif provider='supabase' then
    allowed:=public.verify_registered_student(p_student_id,(p_identity->>'authUserId')::uuid);
  elsif provider='lichess' then
    allowed:=(s.lichess_id is not null and s.lichess_id=p_identity->>'lichessId') or
      (s.lichess_username is not null and lower(s.lichess_username)=lower(p_identity->>'username'));
  end if;
  if allowed is not true then raise exception 'Student login no longer exists.' using errcode='28000'; end if;
  select * into b from public.puzzle_battles where id=p_id;
  if b.id is null then raise exception 'Battle not found.' using errcode='P0002'; end if;
  if b.host_id<>p_student_id and b.guest_id is distinct from p_student_id then
    raise exception 'This battle belongs to other players.' using errcode='42501';
  end if;
  if b.state?'bot' then
    perform public.advance_puzzle_battle_bot(p_id);
    select * into b from public.puzzle_battles where id=p_id;
  end if;
  result:=jsonb_build_object('record',to_jsonb(b));
  if p_include_deck then
    result:=result||jsonb_build_object('deck',(select challenges from public.puzzle_battle_decks where battle_id=p_id));
  end if;
  return result;
end $$;


create or replace function public.write_puzzle_battle_player(p_id uuid,p_student_id uuid,p_revision integer,p_player jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare b public.puzzle_battles; slot integer; st jsonb; a jsonb; z jsonb; winner text;
begin
  select * into b from public.puzzle_battles where id=p_id for update;
  if b.state?'bot' then
    perform public.advance_puzzle_battle_bot(p_id);
    select * into b from public.puzzle_battles where id=p_id;
  end if;
  if b.id is null then return null; end if;
  if b.host_id=p_student_id then slot:=0;
  elsif b.guest_id=p_student_id then slot:=1;
  else raise exception 'This battle belongs to other players.' using errcode='42501'; end if;
  if b.state->>'status'<>'playing' then return to_jsonb(b); end if;
  if extract(epoch from clock_timestamp())*1000 < (b.state->>'startsAt')::numeric then return null; end if;
  if extract(epoch from clock_timestamp())*1000 >= (b.state->>'endsAt')::numeric then return to_jsonb(b); end if;
  if (b.state#>>array['players',slot::text,'revision'])::integer<>p_revision then return null; end if;
  if p_player->>'id' is distinct from p_student_id::text or (p_player->>'revision')::integer is distinct from p_revision+1 then
    raise exception 'Invalid player update.';
  end if;
  st:=jsonb_set(b.state,array['players',slot::text],p_player);
  a:=st#>'{players,0}'; z:=st#>'{players,1}';
  if b.mode='hide-and-seek' and ((p_player->>'score')::integer>0 or (p_player->>'mistakes')::integer>0) then
    winner:=case when (p_player->>'score')::integer>0 then p_student_id::text
      when slot=0 then z->>'id' else a->>'id' end;
    st:=st||jsonb_build_object('status','finished','winnerId',winner);
  elsif (a->>'done')::boolean and (z->>'done')::boolean then
    winner:=case when (a->>'score')::integer=(z->>'score')::integer then null
      when (a->>'score')::integer>(z->>'score')::integer then a->>'id' else z->>'id' end;
    st:=st||jsonb_build_object('status','finished','winnerId',winner);
  end if;
  update public.puzzle_battles set state=st,version=version+1 where id=p_id returning * into b;
  return to_jsonb(b);
end $$;


create or replace function public.write_puzzle_battle(p_id uuid,p_version integer,p_student_id uuid,p_state jsonb)
returns boolean language plpgsql security invoker set search_path='' as $$
declare b public.puzzle_battles; joining boolean;
begin
  perform pg_advisory_xact_lock(hashtextextended('puzzle-battle-player:'||p_student_id::text,0));
  select * into b from public.puzzle_battles where id=p_id for update;
  if b.state?'bot' then
    perform public.advance_puzzle_battle_bot(p_id);
    select * into b from public.puzzle_battles where id=p_id;
  end if;
  if b.id is null or b.version<>p_version then return false; end if;
  joining:=b.host_id<>p_student_id and b.guest_id is distinct from p_student_id;
  if joining then
    if b.state->>'status'<>'waiting' or b.guest_id is not null or p_state#>>'{players,1,id}'<>p_student_id::text then return false; end if;
    if exists(select 1 from public.puzzle_battles other where other.id<>b.id and (other.host_id=p_student_id or other.guest_id=p_student_id) and
      ((other.state->>'status'='waiting' and other.expires_at>clock_timestamp()) or
       (other.state->>'status'='playing' and (other.state->>'endsAt')::numeric>extract(epoch from clock_timestamp())*1000))) then
      raise exception 'Finish or leave your current puzzle battle first.';
    end if;
  end if;
  if b.state->>'status'='waiting' and clock_timestamp()>=b.expires_at and p_state->>'status'<>'cancelled' then return false; end if;
  if b.state->>'status'='playing' and extract(epoch from clock_timestamp())*1000 >= (b.state->>'endsAt')::numeric and p_state->'players'<>b.state->'players' then return false; end if;
  update public.puzzle_battles set state=p_state,version=version+1,guest_id=case when p_state?'bot' then null else (p_state#>>'{players,1,id}')::uuid end where id=p_id;
  return true;
end $$;
