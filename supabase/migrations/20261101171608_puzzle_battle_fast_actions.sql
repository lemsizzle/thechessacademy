-- Only the signed-session server can call these RPCs. Bundle the existing
-- active-profile / credential checks with a battle read to avoid network hops.
create function public.load_puzzle_battle(p_id uuid,p_student_id uuid,p_identity jsonb,p_include_deck boolean default false)
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
  result:=jsonb_build_object('record',to_jsonb(b));
  if p_include_deck then
    result:=result||jsonb_build_object('deck',(select challenges from public.puzzle_battle_decks where battle_id=p_id));
  end if;
  return result;
end $$;

-- Answers from different players must not invalidate each other's writes.
-- Apply only the validated player's delta, guarded by their personal revision.
create function public.write_puzzle_battle_player(p_id uuid,p_student_id uuid,p_revision integer,p_player jsonb)
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
  if (a->>'done')::boolean and (z->>'done')::boolean then
    winner:=case when (a->>'score')::integer=(z->>'score')::integer then null
      when (a->>'score')::integer>(z->>'score')::integer then a->>'id' else z->>'id' end;
    st:=st||jsonb_build_object('status','finished','winnerId',winner);
  end if;
  update public.puzzle_battles set state=st,version=version+1 where id=p_id returning * into b;
  return to_jsonb(b);
end $$;
revoke all on function public.load_puzzle_battle(uuid,uuid,jsonb,boolean) from public,anon,authenticated;
revoke all on function public.write_puzzle_battle_player(uuid,uuid,integer,jsonb) from public,anon,authenticated;
grant execute on function public.load_puzzle_battle(uuid,uuid,jsonb,boolean) to service_role;
grant execute on function public.write_puzzle_battle_player(uuid,uuid,integer,jsonb) to service_role;
