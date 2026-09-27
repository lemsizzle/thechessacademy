-- Reward only newly verified completions; existing history remains unrewarded.
-- The existing xp_events trigger grants exactly one matching coin per XP.
alter table public.student_star_wars_runs
  add column reward_xp integer not null default 0 check (reward_xp between 0 and 1500);
alter table public.student_hide_and_seek_attempts
  add column reward_xp integer not null default 0 check (reward_xp in (0, 10));

create function public.reward_star_wars_progress()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare
  earned integer;
begin
  -- UPDATE locks the run row, so overlapping saves pay only the new levels.
  new.score := greatest(old.score, new.score);
  new.reward_xp := old.reward_xp;
  earned := (new.score - old.score) * 3;
  if earned = 0 then return new; end if;
  update public.students set total_xp = coalesce(total_xp, 0) + earned
    where id = new.student_id and is_active;
  if not found then return new; end if;
  insert into public.xp_events(student_id, amount, reason)
    values (new.student_id, earned,
      'Star Wars: ' || (new.score - old.score) || ' completed level(s), run ' || new.run_id);
  new.reward_xp := old.reward_xp + earned;
  return new;
end;
$$;
revoke all on function public.reward_star_wars_progress() from public, anon, authenticated;
grant execute on function public.reward_star_wars_progress() to service_role;
create trigger reward_star_wars_verified_progress
  before update of score on public.student_star_wars_runs
  for each row execute function public.reward_star_wars_progress();

create function public.reward_hide_and_seek_completion()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if TG_WHEN = 'BEFORE' then
    -- All stars, regardless of speed. Hard-mode explosions are not completions.
    new.reward_xp := case when new.correct_count = new.safe_square_count
      and not (new.mode = 'hard' and new.wrong_count > 0) then 10 else 0 end;
    return new;
  end if;
  if new.reward_xp = 0 then return new; end if;
  update public.students set total_xp = coalesce(total_xp, 0) + 10
    where id = new.student_id and is_active;
  if not found then raise exception 'An active student is required to save rewards.'; end if;
  insert into public.xp_events(student_id, amount, reason)
    values (new.student_id, 10, 'Hide and Seek: all stars found, round ' || new.round_id);
  return new;
end;
$$;
revoke all on function public.reward_hide_and_seek_completion() from public, anon, authenticated;
grant execute on function public.reward_hide_and_seek_completion() to service_role;
-- Compute the returned reward before INSERT, but pay only after a successful INSERT.
-- The unique student/round key prevents retries, including ON CONFLICT, paying twice.
create trigger prepare_hide_and_seek_reward
  before insert on public.student_hide_and_seek_attempts
  for each row execute function public.reward_hide_and_seek_completion();
create trigger reward_hide_and_seek_verified_completion
  after insert on public.student_hide_and_seek_attempts
  for each row execute function public.reward_hide_and_seek_completion();
