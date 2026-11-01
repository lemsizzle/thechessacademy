-- Recheck active credentials on every answer, in the same database round trip
-- as its revision-guarded save. The server can validate from its cached position;
-- PostgreSQL remains authoritative for membership, revision, and deadline.
create function public.submit_puzzle_battle_player(p_id uuid,p_student_id uuid,p_identity jsonb,p_revision integer,p_player jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
begin
  perform public.load_puzzle_battle(p_id,p_student_id,p_identity,false);
  return public.write_puzzle_battle_player(p_id,p_student_id,p_revision,p_player);
end $$;
revoke all on function public.submit_puzzle_battle_player(uuid,uuid,jsonb,integer,jsonb) from public,anon,authenticated;
grant execute on function public.submit_puzzle_battle_player(uuid,uuid,jsonb,integer,jsonb) to service_role;
