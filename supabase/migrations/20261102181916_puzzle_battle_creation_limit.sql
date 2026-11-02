-- Single-board races can legitimately finish more than ten matches in ten
-- minutes. Keep the one-active-room lock, but rate-limit creation bursts only.
create or replace function public.create_puzzle_battle(p_id uuid,p_code text,p_student_id uuid,p_mode text,p_duration integer,p_state jsonb,p_deck jsonb)
returns uuid language plpgsql security invoker set search_path='' as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('puzzle-battle-player:'||p_student_id::text,0));
  if exists(select 1 from public.puzzle_battles b where (b.host_id=p_student_id or b.guest_id=p_student_id) and
    ((b.state->>'status'='waiting' and b.expires_at>clock_timestamp()) or
     (b.state->>'status'='playing' and (b.state->>'endsAt')::numeric>extract(epoch from clock_timestamp())*1000))) then
    raise exception 'Finish or leave your current puzzle battle first.';
  end if;
  if (select count(*) from public.puzzle_battles where host_id=p_student_id and created_at>clock_timestamp()-interval '1 minute')>=20 then
    raise exception 'Please wait up to a minute before creating another challenge.';
  end if;
  insert into public.puzzle_battles(id,code,host_id,mode,duration,state) values(p_id,p_code,p_student_id,p_mode,p_duration,p_state);
  insert into public.puzzle_battle_decks(battle_id,challenges) values(p_id,p_deck);
  return p_id;
end $$;
revoke all on function public.create_puzzle_battle(uuid,text,uuid,text,integer,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.create_puzzle_battle(uuid,text,uuid,text,integer,jsonb,jsonb) to service_role;
