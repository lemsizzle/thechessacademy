-- Preserve existing coin balances while allowing a lower XP rule to become
-- the new synchronization baseline. Future XP then grants coins immediately.
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

  -- A reward-rate reduction can lower calculated cumulative XP. Rebase the
  -- marker without removing coins already earned or spent.
  if v_target < coalesce(v_previous, 0) then
    update public.student_wallets
    set lichess_xp_coins_synced = v_target,
        updated_at = now()
    where student_id = p_student_id;
    v_previous := v_target;
  end if;

  v_delta := greatest(0, v_target - coalesce(v_previous, 0));
  if v_delta > 0 then
    perform public.grant_academy_coins(
      p_student_id,
      v_delta,
      'earn',
      'lichess_xp',
      'v2:' || v_target::text,
      'Academy Coins earned from cumulative Lichess XP.',
      'lichess_xp_v2:' || p_student_id::text || ':' || v_target::text
    );

    update public.student_wallets
    set lichess_xp_coins_synced = v_target,
        updated_at = now()
    where student_id = p_student_id;
  end if;

  return jsonb_build_object(
    'coinsAwarded', v_delta,
    'cumulativeLichessXp', v_target
  );
end;
$$;

-- This privileged function is called only by server-side service-role code.
revoke all on function public.sync_lichess_xp_coins(uuid, integer) from public, anon, authenticated;
grant execute on function public.sync_lichess_xp_coins(uuid, integer) to service_role;
