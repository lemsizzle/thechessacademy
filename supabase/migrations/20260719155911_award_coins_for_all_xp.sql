-- Keep Academy Coins synchronized with every positive XP event.
-- The XP-event UUID is the idempotency key, so retries cannot mint twice.
create or replace function public.award_academy_coins_for_xp_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.amount > 0 then
    perform public.grant_academy_coins(
      new.student_id,
      new.amount,
      'earn',
      'xp_event',
      new.id::text,
      new.reason,
      'xp_event:' || new.id::text
    );
  end if;
  return new;
end;
$$;

revoke all on function public.award_academy_coins_for_xp_event() from public, anon, authenticated;

drop trigger if exists award_academy_coins_after_xp_event on public.xp_events;
create trigger award_academy_coins_after_xp_event
after insert on public.xp_events
for each row
execute function public.award_academy_coins_for_xp_event();

-- Lichess XP is calculated from a cumulative activity snapshot rather than an
-- xp_events row. Store its highest synchronized total to award only the delta.
alter table public.student_wallets
  add column if not exists lichess_xp_coins_synced integer not null default 0;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'student_wallets_lichess_xp_coins_synced_nonnegative'
      and conrelid = 'public.student_wallets'::regclass
  ) then
    alter table public.student_wallets
      add constraint student_wallets_lichess_xp_coins_synced_nonnegative
      check (lichess_xp_coins_synced >= 0);
  end if;
end;
$$;

create or replace function public.sync_lichess_xp_coins(
  p_student_id uuid,
  p_cumulative_lichess_xp integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_target integer := greatest(0, coalesce(p_cumulative_lichess_xp, 0));
  v_previous integer;
  v_delta integer;
begin
  insert into public.student_wallets (
    student_id,
    academy_coins,
    total_coins_earned,
    total_coins_spent,
    lichess_xp_coins_synced
  ) values (p_student_id, 0, 0, 0, 0)
  on conflict (student_id) do nothing;

  select lichess_xp_coins_synced
  into v_previous
  from public.student_wallets
  where student_id = p_student_id
  for update;

  v_delta := greatest(0, v_target - coalesce(v_previous, 0));
  if v_delta > 0 then
    perform public.grant_academy_coins(
      p_student_id,
      v_delta,
      'earn',
      'lichess_xp',
      v_target::text,
      'Academy Coins earned from cumulative Lichess XP.',
      'lichess_xp:' || p_student_id::text || ':' || v_target::text
    );

    update public.student_wallets
    set lichess_xp_coins_synced = v_target,
        updated_at = now()
    where student_id = p_student_id;
  end if;

  return jsonb_build_object(
    'coinsAwarded', v_delta,
    'cumulativeLichessXp', greatest(v_target, coalesce(v_previous, 0))
  );
end;
$$;

revoke all on function public.sync_lichess_xp_coins(uuid, integer) from public, anon, authenticated;
grant execute on function public.sync_lichess_xp_coins(uuid, integer) to service_role;
