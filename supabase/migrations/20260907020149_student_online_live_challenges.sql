-- Private data: only authenticated application routes use the service role.
set local lock_timeout = '5s';
set local statement_timeout = '30s';

create table public.student_online_presence (
  student_id uuid primary key references public.students(id) on delete cascade,
  seen_at timestamptz not null default now()
);
create index student_online_presence_recent on public.student_online_presence(seen_at desc);
alter table public.student_online_presence enable row level security;
revoke all on public.student_online_presence from public, anon, authenticated;
grant select, insert, update, delete on public.student_online_presence to service_role;

create table public.student_live_challenges (
  id uuid primary key default gen_random_uuid(),
  challenger_id uuid not null references public.students(id) on delete cascade,
  recipient_id uuid not null references public.students(id) on delete cascade,
  time_control_id text not null check (time_control_id in ('3+2','5+3','7+2','10m','10+5','15+10')),
  status text not null default 'pending' check (status in ('pending','accepted','declined','cancelled','expired')),
  game_id uuid references public.live_chess_games(id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '2 minutes'),
  check (challenger_id <> recipient_id)
);
create index student_live_challenges_sender on public.student_live_challenges(challenger_id,created_at desc);
create index student_live_challenges_recipient on public.student_live_challenges(recipient_id,created_at desc);
create unique index student_live_challenges_pending_pair on public.student_live_challenges
  (least(challenger_id,recipient_id),greatest(challenger_id,recipient_id)) where status='pending';
alter table public.student_live_challenges enable row level security;
revoke all on public.student_live_challenges from public, anon, authenticated;
grant select, insert, update on public.student_live_challenges to service_role;

-- Identity comes from the server-verified student cookie, never from a client ID.
create function public.touch_student_online(p_student_id uuid) returns void
language sql security invoker set search_path = '' as $$
  insert into public.student_online_presence(student_id,seen_at)
  select id,now() from public.students where id=p_student_id and is_active=true
  on conflict(student_id) do update set seen_at=excluded.seen_at
  where public.student_online_presence.seen_at < now()-interval '25 seconds';
$$;

create function public.create_student_live_challenge(p_student_id uuid,p_recipient_id uuid,p_time_control_id text)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare v_id uuid; v_count integer;
begin
  if p_student_id=p_recipient_id then raise exception 'You cannot challenge yourself.'; end if;
  if p_time_control_id not in ('3+2','5+3','7+2','10m','10+5','15+10') or p_time_control_id is null then
    raise exception 'Choose a supported timed clock.';
  end if;
  perform id from public.students where id in (p_student_id,p_recipient_id) and is_active=true order by id for update;
  get diagnostics v_count=row_count;
  if v_count<>2 then raise exception 'Both students must have active Academy accounts.'; end if;
  if not exists(select 1 from public.student_online_presence where student_id=p_recipient_id and seen_at>now()-interval '75 seconds') then
    raise exception 'That student is no longer online.';
  end if;
  if exists(select 1 from public.live_chess_games where game_mode='live' and status='active'
      and (white_player_id in (p_student_id,p_recipient_id) or black_player_id in (p_student_id,p_recipient_id))) then
    raise exception 'One of you is already playing a live game.';
  end if;
  update public.student_live_challenges set status='expired' where status='pending' and expires_at<=now()
    and (challenger_id=p_student_id or recipient_id=p_student_id);
  if (select count(*) from public.student_live_challenges where challenger_id=p_student_id and status='pending')>=5 then
    raise exception 'You already have five pending challenges.';
  end if;
  if (select count(*) from public.student_live_challenges where challenger_id=p_student_id and created_at>now()-interval '1 minute')>=5 then
    raise exception 'Please wait a minute before sending more challenges.';
  end if;
  if exists(select 1 from public.student_live_challenges where challenger_id=p_student_id and recipient_id=p_recipient_id
      and created_at>now()-interval '30 seconds') then
    raise exception 'Please wait before challenging this student again.';
  end if;
  if exists(select 1 from public.student_live_challenges where status='pending'
    and least(challenger_id,recipient_id)=least(p_student_id,p_recipient_id)
    and greatest(challenger_id,recipient_id)=greatest(p_student_id,p_recipient_id)) then
    raise exception 'A challenge is already pending between you.';
  end if;
  insert into public.student_live_challenges(challenger_id,recipient_id,time_control_id)
    values(p_student_id,p_recipient_id,p_time_control_id) returning id into v_id;
  return v_id;
end;
$$;

create function public.respond_student_live_challenge(p_student_id uuid,p_challenge_id uuid,p_action text)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare c public.student_live_challenges%rowtype; v_count integer; v_game_id uuid;
  v_ms integer; v_increment integer; v_name text; v_white uuid; v_black uuid;
  v_code text; v_fen text := 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
begin
  if p_action not in ('accept','decline','cancel') or p_action is null then raise exception 'Choose accept, decline, or cancel.'; end if;
  select * into c from public.student_live_challenges where id=p_challenge_id;
  if not found then raise exception 'Challenge not found.'; end if;
  if (p_action='cancel' and p_student_id<>c.challenger_id) or (p_action<>'cancel' and p_student_id<>c.recipient_id) then
    raise exception 'You are not allowed to respond to this challenge.';
  end if;
  -- The same lock order is used for send and accept, preventing double accepts.
  perform id from public.students where id in (c.challenger_id,c.recipient_id) and is_active=true order by id for update;
  get diagnostics v_count=row_count;
  select * into c from public.student_live_challenges where id=p_challenge_id for update;
  if c.status='accepted' and p_action='accept' then return jsonb_build_object('status',c.status,'gameId',c.game_id); end if;
  if c.status<>'pending' then raise exception 'This challenge is no longer pending.'; end if;
  if c.expires_at<=now() then
    update public.student_live_challenges set status='expired' where id=c.id;
    return jsonb_build_object('status','expired');
  end if;
  if p_action<>'accept' then
    update public.student_live_challenges set status=case when p_action='cancel' then 'cancelled' else 'declined' end where id=c.id;
    return jsonb_build_object('status',case when p_action='cancel' then 'cancelled' else 'declined' end);
  end if;
  if v_count<>2 then raise exception 'Both students must have active Academy accounts.'; end if;
  if not exists(select 1 from public.student_online_presence where student_id=c.challenger_id and seen_at>now()-interval '75 seconds') then
    raise exception 'The challenger is no longer online.';
  end if;
  if exists(select 1 from public.live_chess_games where game_mode='live' and status='active'
      and (white_player_id in (c.challenger_id,c.recipient_id) or black_player_id in (c.challenger_id,c.recipient_id))) then
    raise exception 'One of you is already playing a live game.';
  end if;
  select ms,inc,label into v_ms,v_increment,v_name from (values
    ('3+2',180000,2000,'3 + 2'),('5+3',300000,3000,'5 + 3'),('7+2',420000,2000,'7 + 2'),
    ('10m',600000,0,'10 min'),('10+5',600000,5000,'10 + 5'),('15+10',900000,10000,'15 + 10')
  ) as controls(id,ms,inc,label) where id=c.time_control_id;
  v_white := case when random()<0.5 then c.challenger_id else c.recipient_id end;
  v_black := case when v_white=c.challenger_id then c.recipient_id else c.challenger_id end;
  for attempt in 1..10 loop
    v_code := upper(substr(replace(gen_random_uuid()::text,'-',''),1,4));
    begin
      insert into public.live_chess_games(challenge_code,created_by,white_player_id,black_player_id,status,
        time_control_id,time_control,initial_fen,current_fen,white_ms,black_ms,clock_started_at,started_at,rated,game_mode)
      values(v_code,c.challenger_id,v_white,v_black,'active',c.time_control_id,
        jsonb_build_object('id',c.time_control_id,'name',v_name,'initialMs',v_ms,'incrementMs',v_increment),
        v_fen,v_fen,v_ms,v_ms,now(),now(),true,'live') returning id into v_game_id;
      exit;
    exception when unique_violation then
      if attempt=10 then raise; end if;
    end;
  end loop;
  update public.student_live_challenges set status='accepted',game_id=v_game_id where id=c.id;
  return jsonb_build_object('status','accepted','gameId',v_game_id);
end;
$$;

revoke all on function public.touch_student_online(uuid) from public, anon, authenticated;
revoke all on function public.create_student_live_challenge(uuid,uuid,text) from public, anon, authenticated;
revoke all on function public.respond_student_live_challenge(uuid,uuid,text) from public, anon, authenticated;
grant execute on function public.touch_student_online(uuid) to service_role;
grant execute on function public.create_student_live_challenge(uuid,uuid,text) to service_role;
grant execute on function public.respond_student_live_challenge(uuid,uuid,text) to service_role;
