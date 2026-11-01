-- Signed Academy sessions are checked by the application. Only its service role
-- may read answers or mutate a battle; no puzzle solutions go over Realtime.
create table public.puzzle_battles (
  id uuid primary key,
  code text not null unique,
  host_id uuid not null references public.students(id) on delete cascade,
  guest_id uuid references public.students(id) on delete cascade,
  mode text not null check(mode in ('survival','star-wars','hide-and-seek')),
  duration integer not null check(duration in (60,180,300,600)),
  version integer not null default 0,
  state jsonb not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now()+interval '10 minutes',
  realtime_token uuid not null default gen_random_uuid()
);
create table public.puzzle_battle_decks (
  battle_id uuid primary key references public.puzzle_battles(id) on delete cascade,
  challenges jsonb not null check(jsonb_array_length(challenges) between 1 and 100)
);
create index puzzle_battles_host_idx on public.puzzle_battles(host_id,created_at desc);
create index puzzle_battles_guest_idx on public.puzzle_battles(guest_id,created_at desc);
create index puzzle_battles_waiting_idx on public.puzzle_battles(created_at desc) where state->>'status'='waiting';
alter table public.puzzle_battles enable row level security;
alter table public.puzzle_battle_decks enable row level security;
revoke all on public.puzzle_battles,public.puzzle_battle_decks from public,anon,authenticated;
grant select,insert,update,delete on public.puzzle_battles,public.puzzle_battle_decks to service_role;

create function public.create_puzzle_battle(p_id uuid,p_code text,p_student_id uuid,p_mode text,p_duration integer,p_state jsonb,p_deck jsonb)
returns uuid language plpgsql security invoker set search_path='' as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('puzzle-battle-player:'||p_student_id::text,0));
  if exists(select 1 from public.puzzle_battles b where (b.host_id=p_student_id or b.guest_id=p_student_id) and
    ((b.state->>'status'='waiting' and b.expires_at>clock_timestamp()) or
     (b.state->>'status'='playing' and (b.state->>'endsAt')::numeric>extract(epoch from clock_timestamp())*1000))) then
    raise exception 'Finish or leave your current puzzle battle first.';
  end if;
  if (select count(*) from public.puzzle_battles where host_id=p_student_id and created_at>now()-interval '10 minutes')>=10 then
    raise exception 'Please wait before creating another challenge.';
  end if;
  insert into public.puzzle_battles(id,code,host_id,mode,duration,state) values(p_id,p_code,p_student_id,p_mode,p_duration,p_state);
  insert into public.puzzle_battle_decks(battle_id,challenges) values(p_id,p_deck);
  return p_id;
end $$;

create function public.write_puzzle_battle(p_id uuid,p_version integer,p_student_id uuid,p_state jsonb)
returns boolean language plpgsql security invoker set search_path='' as $$
declare b public.puzzle_battles; joining boolean;
begin
  perform pg_advisory_xact_lock(hashtextextended('puzzle-battle-player:'||p_student_id::text,0));
  select * into b from public.puzzle_battles where id=p_id for update;
  if b.id is null or b.version<>p_version then return false; end if;
  joining:=b.host_id<>p_student_id and b.guest_id is distinct from p_student_id;
  if joining then
    if b.state->>'status'<>'waiting' or b.guest_id is not null or p_state#>>'{players,1,id}'<>p_student_id::text then return false; end if;
    if exists(select 1 from public.puzzle_battles other where other.id<>b.id and (other.host_id=p_student_id or other.guest_id=p_student_id) and
      ((other.state->>'status'='waiting' and other.expires_at>clock_timestamp()) or
       (other.state->>'status'='playing' and (other.state->>'endsAt')::numeric>extract(epoch from clock_timestamp())*1000))) then
      raise exception 'Finish or leave your current puzzle battle first.';
    end if;
  end if;
  if b.state->>'status'='waiting' and clock_timestamp()>=b.expires_at and p_state->>'status'<>'cancelled' then return false; end if;
  if b.state->>'status'='playing' and extract(epoch from clock_timestamp())*1000 >= (b.state->>'endsAt')::numeric and p_state->'players'<>b.state->'players' then return false; end if;
  update public.puzzle_battles set state=p_state,version=version+1,guest_id=(p_state#>>'{players,1,id}')::uuid where id=p_id;
  return true;
end $$;
revoke all on function public.create_puzzle_battle(uuid,text,uuid,text,integer,jsonb,jsonb) from public,anon,authenticated;
revoke all on function public.write_puzzle_battle(uuid,integer,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.create_puzzle_battle(uuid,text,uuid,text,integer,jsonb,jsonb) to service_role;
grant execute on function public.write_puzzle_battle(uuid,integer,uuid,jsonb) to service_role;

-- Unpredictable topic, containing only an invalidation. Client broadcasts are
-- never trusted for scores. Signed-session API checks still protect every read.
create function public.notify_puzzle_battle() returns trigger language plpgsql security invoker set search_path='' as $$
begin
  if new.state->>'status' is distinct from old.state->>'status'
    or new.guest_id is distinct from old.guest_id
    or new.state#>'{players,0,ready}' is distinct from old.state#>'{players,0,ready}'
    or new.state#>'{players,1,ready}' is distinct from old.state#>'{players,1,ready}'
    or new.state#>'{players,0,index}' is distinct from old.state#>'{players,0,index}'
    or new.state#>'{players,1,index}' is distinct from old.state#>'{players,1,index}' then
    begin
      perform realtime.send(jsonb_build_object('version',new.version),'battle_changed','puzzle-battle:'||new.id::text||':'||new.realtime_token::text,false);
    exception when others then null; -- fallback refresh still works
    end;
  end if;
  return new;
end $$;
revoke all on function public.notify_puzzle_battle() from public,anon,authenticated;
grant execute on function public.notify_puzzle_battle() to service_role;
create trigger puzzle_battle_changed after update on public.puzzle_battles for each row execute function public.notify_puzzle_battle();
