-- Keep the existing minute-by-minute recovery cadence, but only invoke Vercel
-- when its maintenance handler has work. No clocks, pairings or prizes change.
create or replace function public.arena_maintenance_needed() returns boolean
language sql stable security invoker set search_path='' as $$
  select exists (
    select 1 from public.internal_arena_tournaments t
    where
      -- Status transitions, including legacy tournaments and arenas whose whole
      -- scheduled window elapsed while the app was unavailable.
      (t.status='scheduled' and (t.starts_at<=now() or t.ends_at<=now()))
      or (t.status='active' and t.ends_at<=now())
      -- Match the recovery/settlement set used by unsettled_arena_ids(). Keep
      -- retrying unfinished results even when no students have a browser open.
      or (t.experience_version=1 and t.status in ('active','finished')
        and not exists (
          select 1 from public.internal_arena_results r where r.tournament_id=t.id
        ))
  );
$$;
revoke all on function public.arena_maintenance_needed() from public,anon,authenticated;
grant execute on function public.arena_maintenance_needed() to service_role;

-- Updating the named job preserves a single scheduler and the existing secret.
select cron.schedule('academy-arena-maintenance','* * * * *',$job$
  select net.http_post(
    url:='https://thechessacademy.vercel.app/api/cron/internal-arenas',
    headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||decrypted_secret),
    body:='{}'::jsonb,
    timeout_milliseconds:=55000
  )
  from vault.decrypted_secrets
  where name='academy_arena_maintenance_token'
    and (select public.arena_maintenance_needed());
$job$);
