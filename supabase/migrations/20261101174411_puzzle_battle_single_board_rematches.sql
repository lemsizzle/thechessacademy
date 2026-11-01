-- First verified Hide and Seek finish decides the entire match under the row lock.
-- One shared rematch link per result, even when both students request it at once.
create function public.rematch_puzzle_battle(p_source_id uuid,p_student_id uuid,p_id uuid,p_code text,p_state jsonb,p_deck jsonb)
returns uuid language plpgsql security invoker set search_path='' as $$
declare b public.puzzle_battles; pending public.puzzle_battles; opponent uuid;
begin
  perform pg_advisory_xact_lock(hashtextextended('puzzle-battle-player:'||p_student_id::text,0));
  select * into b from public.puzzle_battles where id=p_source_id for update;
  if b.id is null or (b.host_id<>p_student_id and b.guest_id is distinct from p_student_id) then
    raise exception 'This battle belongs to other players.' using errcode='42501';
  end if;
  if b.state->>'status'<>'finished' or b.guest_id is null then raise exception 'Finish this battle before a rematch.'; end if;
  if b.state->>'rematchId' is not null then
    select * into pending from public.puzzle_battles where id=(b.state->>'rematchId')::uuid;
    if pending.id is not null and pending.state->>'status'<>'cancelled'
      and not (pending.state->>'status'='waiting' and pending.expires_at<=clock_timestamp()) then
      return pending.id;
    end if;
  end if;
  opponent:=case when b.host_id=p_student_id then b.guest_id else b.host_id end;
  if p_state#>>'{players,0,id}' is distinct from p_student_id::text or p_state->>'invitedId' is distinct from opponent::text then
    raise exception 'Invalid rematch players.';
  end if;
  perform public.create_puzzle_battle(p_id,p_code,p_student_id,b.mode,b.duration,p_state,p_deck);
  update public.puzzle_battles set state=state||jsonb_build_object('rematchId',p_id),version=version+1 where id=p_source_id;
  return p_id;
end $$;
revoke all on function public.rematch_puzzle_battle(uuid,uuid,uuid,text,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.rematch_puzzle_battle(uuid,uuid,uuid,text,jsonb,jsonb) to service_role;

create or replace function public.write_puzzle_battle_player(p_id uuid,p_student_id uuid,p_revision integer,p_player jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare b public.puzzle_battles; slot integer; st jsonb; a jsonb; z jsonb; winner text;
begin
  select * into b from public.puzzle_battles where id=p_id for update;
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

create or replace function public.notify_puzzle_battle() returns trigger language plpgsql security invoker set search_path='' as $$
begin
  if new.state->>'rematchId' is distinct from old.state->>'rematchId' or new.state->>'status' is distinct from old.state->>'status'
    or new.guest_id is distinct from old.guest_id
    or new.state#>'{players,0,ready}' is distinct from old.state#>'{players,0,ready}'
    or new.state#>'{players,1,ready}' is distinct from old.state#>'{players,1,ready}'
    or new.state#>'{players,0,index}' is distinct from old.state#>'{players,0,index}'
    or new.state#>'{players,1,index}' is distinct from old.state#>'{players,1,index}' then
    begin
      perform realtime.send(jsonb_build_object('version',new.version),'battle_changed','puzzle-battle:'||new.id::text||':'||new.realtime_token::text,false);
    exception when others then null; -- fallback refresh still works
    end;
  end if;
  return new;
end $$;
