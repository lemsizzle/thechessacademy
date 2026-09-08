-- Supabase Cron runs independently of browsers and Vercel's cron-plan limits.
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Deployment configures the token only AFTER the protected application route is live.
-- Nothing is sent until then. Never put the token in a migration or cron command.
select cron.schedule('academy-arena-maintenance','* * * * *',$job$
  select net.http_post(
    url:='https://thechessacademy.vercel.app/api/cron/internal-arenas',
    headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||decrypted_secret),
    body:='{}'::jsonb,
    timeout_milliseconds:=55000
  )
  from vault.decrypted_secrets where name='academy_arena_maintenance_token';
$job$);

create function public.configure_arena_maintenance(p_secret text) returns void
language plpgsql security invoker set search_path='' as $$
declare secret_id uuid;
begin
 if length(p_secret)<20 then raise exception 'A strong maintenance token is required.'; end if;
 select id into secret_id from vault.secrets where name='academy_arena_maintenance_token';
 if secret_id is null then
   perform vault.create_secret(p_secret,'academy_arena_maintenance_token','Arena maintenance authorization');
 else
   perform vault.update_secret(secret_id,p_secret);
 end if;
end;
$$;
revoke all on function public.configure_arena_maintenance(text) from public,anon,authenticated;
grant execute on function public.configure_arena_maintenance(text) to service_role;
