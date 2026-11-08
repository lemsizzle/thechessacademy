-- Late entrants join the next unpaired round. Current matches and their scores
-- remain untouched; the same tournament row lock serializes entry and pairing.
create or replace function public.edit_puzzle_tournament_entry(p_id uuid,p_action text,p_entry jsonb)
returns void language plpgsql security invoker set search_path='' as $$
declare t public.puzzle_battle_tournaments; sid uuid:=(p_entry->>'studentId')::uuid;
begin
  select * into t from public.puzzle_battle_tournaments where id=p_id for update;
  if t.id is null then raise exception 'Tournament not found.'; end if;
  if p_action='join' then
    if not exists(select 1 from public.students where id=sid and is_active=true) then raise exception 'Active student required.'; end if;
    if exists(select 1 from public.puzzle_tournament_entries where tournament_id=p_id and student_id=sid) then return; end if;
  elsif p_action='bot' and exists(select 1 from public.puzzle_tournament_entries where tournament_id=p_id and id=(p_entry->>'id')::uuid) then
    return;
  end if;
  if t.status in ('finished','cancelled') then raise exception 'This tournament is closed.'; end if;
  if t.status='active' then
    if p_action not in ('join','bot') then raise exception 'Existing players and ratings are locked after the tournament starts.'; end if;
    if t.round>=t.rounds then raise exception 'The final round has already been paired. Join the next tournament.'; end if;
  end if;
  if p_action in ('join','bot') then
    if (select count(*) from public.puzzle_tournament_entries where tournament_id=p_id)>=32 then raise exception 'This tournament is full (32 players).'; end if;
    insert into public.puzzle_tournament_entries(id,tournament_id,student_id,name,elo)
    values((p_entry->>'id')::uuid,p_id,case when p_action='join' then sid end,p_entry->>'name',case when p_action='bot' then (p_entry->>'elo')::integer end)
    on conflict(id) do nothing;
  elsif p_action='leave' then
    delete from public.puzzle_tournament_entries where tournament_id=p_id and student_id=sid;
  elsif p_action='remove' then
    delete from public.puzzle_tournament_entries where tournament_id=p_id and id=(p_entry->>'id')::uuid;
  elsif p_action='rating' then
    update public.puzzle_tournament_entries set elo=(p_entry->>'elo')::integer
    where tournament_id=p_id and id=(p_entry->>'id')::uuid and student_id is null;
  else raise exception 'Unknown roster action.';
  end if;
  -- Any round preparation based on the old roster must retry with these players.
  update public.puzzle_battle_tournaments set version=version+1,advance_token=null,advance_until=null where id=p_id;
end $$;
