-- Path Finder keeps the existing run identity, scores, and earned rewards.
-- Only newly completed puzzles use the new 2 XP / 2 coin rate.
create or replace function public.reward_star_wars_progress()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare
  earned integer;
begin
  -- UPDATE locks the row; overlapping/retried saves pay only the score delta.
  new.score := greatest(old.score, new.score);
  new.reward_xp := old.reward_xp;
  earned := (new.score - old.score) * 2;
  if earned = 0 then return new; end if;
  update public.students set total_xp = coalesce(total_xp, 0) + earned
    where id = new.student_id and is_active;
  if not found then return new; end if;
  -- The existing XP-event trigger grants the matching coins atomically.
  insert into public.xp_events(student_id, amount, reason)
    values (new.student_id, earned,
      'Path Finder: ' || (new.score - old.score) || ' completed puzzle(s), run ' || new.run_id);
  new.reward_xp := old.reward_xp + earned;
  return new;
end;
$$;
revoke all on function public.reward_star_wars_progress() from public, anon, authenticated;
grant execute on function public.reward_star_wars_progress() to service_role;
