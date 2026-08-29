-- Academy-wide correspondence challenges. The custom Lichess student session
-- is verified by Next.js; browser database roles never receive direct access.
-- Mutating RPCs are SECURITY INVOKER and executable only by service_role.

alter table public.live_chess_games
  add column if not exists game_mode text not null default 'live',
  add column if not exists days_per_move integer,
  add column if not exists turn_deadline_at timestamptz;

alter table public.live_chess_games
  drop constraint if exists live_chess_games_game_mode_valid;
alter table public.live_chess_games
  add constraint live_chess_games_game_mode_valid
  check (game_mode in ('live', 'correspondence'));

alter table public.live_chess_games
  drop constraint if exists live_chess_games_correspondence_shape;
alter table public.live_chess_games
  add constraint live_chess_games_correspondence_shape check (
    (
      game_mode = 'live'
      and days_per_move is null
      and turn_deadline_at is null
    )
    or
    (
      game_mode = 'correspondence'
      and days_per_move = 3
      and time_control_id = 'none'
      and white_ms is null
      and black_ms is null
      and clock_started_at is null
      and not rated
      and not matchmaking
      and arena_tournament_id is null
      and rematch_requested_by is null
      and rematch_game_id is null
      and rematch_of_game_id is null
      and (
        (status = 'active' and turn_deadline_at is not null)
        or (status in ('completed', 'cancelled') and turn_deadline_at is null)
      )
    )
  );

create index if not exists live_chess_games_correspondence_deadline_idx
  on public.live_chess_games(turn_deadline_at, id)
  where game_mode = 'correspondence' and status = 'active';
create index if not exists live_chess_games_correspondence_white_idx
  on public.live_chess_games(white_player_id, updated_at desc, id)
  where game_mode = 'correspondence' and status = 'active';
create index if not exists live_chess_games_correspondence_black_idx
  on public.live_chess_games(black_player_id, updated_at desc, id)
  where game_mode = 'correspondence' and status = 'active';

comment on column public.live_chess_games.game_mode is
  'Separates synchronous live/Arena games from asynchronous correspondence games.';
comment on column public.live_chess_games.days_per_move is
  'Fixed move allowance for correspondence games; null for live games.';
comment on column public.live_chess_games.turn_deadline_at is
  'Authoritative deadline for the side whose color is stored in active_color.';

alter table public.internal_chess_games
  add column if not exists game_mode text not null default 'live';

alter table public.internal_chess_games
  drop constraint if exists internal_chess_games_game_mode_valid;
alter table public.internal_chess_games
  add constraint internal_chess_games_game_mode_valid
  check (game_mode in ('live', 'correspondence'));

create index if not exists internal_chess_games_player_mode_completed_idx
  on public.internal_chess_games(player_id, game_mode, completed_at desc, id desc);

comment on column public.internal_chess_games.game_mode is
  'Persists whether a completed student game was synchronous live play or correspondence.';

create table if not exists public.student_correspondence_inboxes (
  student_id uuid primary key references public.students(id) on delete cascade,
  realtime_token uuid not null default gen_random_uuid() unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.student_correspondence_challenges (
  id uuid primary key default gen_random_uuid(),
  challenger_id uuid not null references public.students(id) on delete cascade,
  recipient_id uuid not null references public.students(id) on delete cascade,
  status text not null default 'pending',
  expires_at timestamptz not null default (now() + interval '7 days'),
  recipient_seen_at timestamptz,
  responded_at timestamptz,
  cancelled_at timestamptz,
  expired_at timestamptz,
  accepted_game_id uuid unique references public.live_chess_games(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint student_correspondence_challenges_players_distinct
    check (challenger_id <> recipient_id),
  constraint student_correspondence_challenges_status_valid
    check (status in ('pending', 'accepted', 'rejected', 'cancelled', 'expired')),
  constraint student_correspondence_challenges_expiry_valid
    check (expires_at > created_at),
  constraint student_correspondence_challenges_status_shape check (
    (
      status = 'pending'
      and accepted_game_id is null
      and responded_at is null
      and cancelled_at is null
      and expired_at is null
    )
    or (
      status = 'accepted'
      and accepted_game_id is not null
      and responded_at is not null
      and cancelled_at is null
      and expired_at is null
    )
    or (
      status = 'rejected'
      and accepted_game_id is null
      and responded_at is not null
      and cancelled_at is null
      and expired_at is null
    )
    or (
      status = 'cancelled'
      and accepted_game_id is null
      and responded_at is null
      and cancelled_at is not null
      and expired_at is null
    )
    or (
      status = 'expired'
      and accepted_game_id is null
      and responded_at is null
      and cancelled_at is null
      and expired_at is not null
    )
  )
);

create index if not exists student_correspondence_challenges_recipient_idx
  on public.student_correspondence_challenges(recipient_id, status, created_at desc, id desc);
create index if not exists student_correspondence_challenges_challenger_idx
  on public.student_correspondence_challenges(challenger_id, status, created_at desc, id desc);
create index if not exists student_correspondence_challenges_incoming_pending_idx
  on public.student_correspondence_challenges(recipient_id, created_at desc, id)
  where status = 'pending';
create index if not exists student_correspondence_challenges_outgoing_pending_idx
  on public.student_correspondence_challenges(challenger_id, created_at desc, id)
  where status = 'pending';
create index if not exists student_correspondence_challenges_pending_expiry_idx
  on public.student_correspondence_challenges(expires_at, id)
  where status = 'pending';
create unique index if not exists student_correspondence_challenges_pending_pair_unique
  on public.student_correspondence_challenges(
    least(challenger_id, recipient_id),
    greatest(challenger_id, recipient_id)
  )
  where status = 'pending';

alter table public.student_correspondence_inboxes enable row level security;
alter table public.student_correspondence_challenges enable row level security;

revoke all on table public.student_correspondence_inboxes
  from public, anon, authenticated, service_role;
revoke all on table public.student_correspondence_challenges
  from public, anon, authenticated, service_role;
grant select, insert, update on table public.student_correspondence_inboxes to service_role;
grant select, insert, update, delete on table public.student_correspondence_challenges to service_role;

drop policy if exists "Correspondence inboxes are server-only"
  on public.student_correspondence_inboxes;
create policy "Correspondence inboxes are server-only"
on public.student_correspondence_inboxes for all to anon, authenticated
using (false) with check (false);

drop policy if exists "Correspondence challenges are server-only"
  on public.student_correspondence_challenges;
create policy "Correspondence challenges are server-only"
on public.student_correspondence_challenges for all to anon, authenticated
using (false) with check (false);

create or replace function public.set_student_correspondence_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke all on function public.set_student_correspondence_updated_at()
  from public, anon, authenticated, service_role;

drop trigger if exists set_student_correspondence_inbox_updated_at
  on public.student_correspondence_inboxes;
create trigger set_student_correspondence_inbox_updated_at
before update on public.student_correspondence_inboxes
for each row execute function public.set_student_correspondence_updated_at();

drop trigger if exists set_student_correspondence_challenge_updated_at
  on public.student_correspondence_challenges;
create trigger set_student_correspondence_challenge_updated_at
before update on public.student_correspondence_challenges
for each row execute function public.set_student_correspondence_updated_at();

create or replace function public.prepare_correspondence_game_write()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_now timestamptz := clock_timestamp();
begin
  if tg_op = 'UPDATE' and old.game_mode is distinct from new.game_mode then
    raise exception 'A game mode cannot be changed after the game is created.';
  end if;

  if new.game_mode <> 'correspondence' then
    return new;
  end if;

  if tg_op = 'UPDATE'
     and old.status = 'active'
     and old.turn_deadline_at is not null
     and old.turn_deadline_at <= v_now
     and not (new.status = 'completed' and new.result_reason = 'timeout') then
    raise exception 'The correspondence move deadline has expired.' using errcode = '23514';
  end if;

  if tg_op = 'INSERT' and new.status = 'active' and new.turn_deadline_at is null then
    new.turn_deadline_at := v_now + make_interval(days => new.days_per_move);
  elsif tg_op = 'UPDATE' then
    if old.status = 'active'
       and new.status = 'active'
       and new.moves is distinct from old.moves then
      if old.turn_deadline_at is null or old.turn_deadline_at <= v_now then
        raise exception 'The correspondence move deadline has expired.' using errcode = '23514';
      end if;
      new.turn_deadline_at := v_now + make_interval(days => new.days_per_move);
    elsif new.status <> 'active' then
      new.turn_deadline_at := null;
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.prepare_correspondence_game_write()
  from public, anon, authenticated, service_role;

drop trigger if exists prepare_correspondence_game_write on public.live_chess_games;
create trigger prepare_correspondence_game_write
before insert or update on public.live_chess_games
for each row execute function public.prepare_correspondence_game_write();

create or replace function public.broadcast_student_correspondence_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_challenger_token uuid;
  v_recipient_token uuid;
  v_payload jsonb;
begin
  select inbox.realtime_token into v_challenger_token
  from public.student_correspondence_inboxes inbox
  where inbox.student_id = new.challenger_id;

  select inbox.realtime_token into v_recipient_token
  from public.student_correspondence_inboxes inbox
  where inbox.student_id = new.recipient_id;

  v_payload := jsonb_build_object(
    'challengeId', new.id,
    'status', new.status,
    'updatedAt', new.updated_at
  );

  if v_challenger_token is not null then
    perform realtime.send(
      v_payload,
      'correspondence_changed',
      'student-correspondence:' || new.challenger_id::text || ':' || v_challenger_token::text,
      false
    );
  end if;

  if v_recipient_token is not null and v_recipient_token <> v_challenger_token then
    perform realtime.send(
      v_payload,
      'correspondence_changed',
      'student-correspondence:' || new.recipient_id::text || ':' || v_recipient_token::text,
      false
    );
  end if;

  return null;
end;
$$;

revoke all on function public.broadcast_student_correspondence_change()
  from public, anon, authenticated, service_role;

drop trigger if exists broadcast_student_correspondence_change
  on public.student_correspondence_challenges;
create trigger broadcast_student_correspondence_change
after insert or update on public.student_correspondence_challenges
for each row execute function public.broadcast_student_correspondence_change();

create or replace function public.ensure_student_correspondence_inbox(
  p_student_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_token uuid;
begin
  if not exists (
    select 1 from public.students
    where id = p_student_id and is_active = true
  ) then
    raise exception 'Active student not found.';
  end if;

  insert into public.student_correspondence_inboxes(student_id)
  values (p_student_id)
  on conflict (student_id) do nothing;

  select realtime_token into strict v_token
  from public.student_correspondence_inboxes
  where student_id = p_student_id;

  return jsonb_build_object(
    'realtimeToken', v_token,
    'realtimeTopic', 'student-correspondence:' || p_student_id::text || ':' || v_token::text
  );
end;
$$;

create or replace function public.expire_student_correspondence_challenges(
  p_student_id uuid default null
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_expired_count integer;
begin
  update public.student_correspondence_challenges
  set status = 'expired',
      expired_at = now()
  where status = 'pending'
    and expires_at <= now()
    and (
      p_student_id is null
      or challenger_id = p_student_id
      or recipient_id = p_student_id
    );

  get diagnostics v_expired_count = row_count;
  return jsonb_build_object('expiredCount', v_expired_count);
end;
$$;

create or replace function public.settle_correspondence_game_deadlines(
  p_student_id uuid default null,
  p_game_id uuid default null
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_ids jsonb;
  v_now timestamptz := clock_timestamp();
begin
  with settled as (
    update public.live_chess_games game
    set status = 'completed',
        winner_color = case game.active_color when 'white' then 'black' else 'white' end,
        result_reason = 'timeout',
        completed_at = v_now,
        turn_deadline_at = null,
        draw_offered_by = null,
        clock_started_at = null,
        version = game.version + 1
    where game.game_mode = 'correspondence'
      and game.status = 'active'
      and game.turn_deadline_at is not null
      and game.turn_deadline_at <= v_now
      and (p_game_id is null or game.id = p_game_id)
      and (
        p_student_id is null
        or game.white_player_id = p_student_id
        or game.black_player_id = p_student_id
      )
    returning game.id
  )
  select coalesce(jsonb_agg(settled.id order by settled.id), '[]'::jsonb)
  into v_ids
  from settled;

  return jsonb_build_object('settledGameIds', v_ids);
end;
$$;

create or replace function public.create_student_correspondence_challenge(
  p_challenger_id uuid,
  p_recipient_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_student_count integer;
  v_outgoing_count integer;
  v_challenger_games integer;
  v_recipient_games integer;
  v_challenge public.student_correspondence_challenges%rowtype;
begin
  if p_challenger_id = p_recipient_id then
    raise exception 'You cannot challenge yourself.';
  end if;

  perform public.expire_student_correspondence_challenges(p_challenger_id);

  -- Serialize cap and duplicate checks for every operation involving the pair.
  perform student.id
  from public.students student
  where student.id in (p_challenger_id, p_recipient_id)
  order by student.id
  for update;
  get diagnostics v_student_count = row_count;

  if v_student_count <> 2 or (
    select count(*)
    from public.students
    where id in (p_challenger_id, p_recipient_id) and is_active = true
  ) <> 2 then
    raise exception 'Both students must have active Academy accounts.';
  end if;

  select count(*) into v_outgoing_count
  from public.student_correspondence_challenges
  where challenger_id = p_challenger_id and status = 'pending';
  if v_outgoing_count >= 5 then
    raise exception 'You already have 5 outgoing correspondence challenges.';
  end if;

  select count(*) into v_challenger_games
  from public.live_chess_games
  where game_mode = 'correspondence' and status = 'active'
    and (white_player_id = p_challenger_id or black_player_id = p_challenger_id);
  select count(*) into v_recipient_games
  from public.live_chess_games
  where game_mode = 'correspondence' and status = 'active'
    and (white_player_id = p_recipient_id or black_player_id = p_recipient_id);

  if v_challenger_games >= 10 then
    raise exception 'You already have 10 active correspondence games.';
  end if;
  if v_recipient_games >= 10 then
    raise exception 'That student already has 10 active correspondence games.';
  end if;

  if exists (
    select 1 from public.student_correspondence_challenges challenge
    where challenge.status = 'pending'
      and least(challenge.challenger_id, challenge.recipient_id)
          = least(p_challenger_id, p_recipient_id)
      and greatest(challenge.challenger_id, challenge.recipient_id)
          = greatest(p_challenger_id, p_recipient_id)
  ) then
    raise exception 'A correspondence challenge is already pending between these students.';
  end if;

  perform public.ensure_student_correspondence_inbox(p_challenger_id);
  perform public.ensure_student_correspondence_inbox(p_recipient_id);

  begin
    insert into public.student_correspondence_challenges(
      challenger_id, recipient_id, expires_at
    ) values (
      p_challenger_id, p_recipient_id, now() + interval '7 days'
    ) returning * into v_challenge;
  exception when unique_violation then
    raise exception 'A correspondence challenge is already pending between these students.'
      using errcode = '23505';
  end;

  return jsonb_build_object(
    'challengeId', v_challenge.id,
    'status', v_challenge.status,
    'expiresAt', v_challenge.expires_at
  );
end;
$$;

create or replace function public.respond_student_correspondence_challenge(
  p_challenge_id uuid,
  p_recipient_id uuid,
  p_action text
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_challenge public.student_correspondence_challenges%rowtype;
  v_student_count integer;
  v_challenger_games integer;
  v_recipient_games integer;
  v_white_id uuid;
  v_black_id uuid;
  v_game_id uuid;
  v_challenge_code text;
  v_attempt integer;
  v_now timestamptz := now();
  v_initial_fen constant text := 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
begin
  if p_action not in ('accept', 'reject') then
    raise exception 'Choose accept or reject.';
  end if;

  select * into v_challenge
  from public.student_correspondence_challenges
  where id = p_challenge_id
  for update;

  if not found then
    raise exception 'Correspondence challenge not found.';
  end if;
  if v_challenge.recipient_id <> p_recipient_id then
    raise exception 'Only the challenge recipient can respond.';
  end if;

  if v_challenge.status = 'pending' and v_challenge.expires_at <= v_now then
    update public.student_correspondence_challenges
    set status = 'expired', expired_at = v_now
    where id = v_challenge.id;
    return jsonb_build_object(
      'challengeId', v_challenge.id,
      'status', 'expired',
      'gameId', null
    );
  end if;

  if p_action = 'accept' and v_challenge.status = 'accepted' then
    return jsonb_build_object(
      'challengeId', v_challenge.id,
      'status', 'accepted',
      'gameId', v_challenge.accepted_game_id
    );
  end if;
  if p_action = 'reject' and v_challenge.status = 'rejected' then
    return jsonb_build_object(
      'challengeId', v_challenge.id,
      'status', 'rejected',
      'gameId', null
    );
  end if;
  if v_challenge.status <> 'pending' then
    raise exception 'This correspondence challenge is already %.', v_challenge.status;
  end if;

  if p_action = 'reject' then
    update public.student_correspondence_challenges
    set status = 'rejected',
        responded_at = v_now,
        recipient_seen_at = coalesce(recipient_seen_at, v_now)
    where id = v_challenge.id;
    return jsonb_build_object(
      'challengeId', v_challenge.id,
      'status', 'rejected',
      'gameId', null
    );
  end if;

  -- Lock both accounts in UUID order so concurrent accepts cannot exceed caps.
  perform student.id
  from public.students student
  where student.id in (v_challenge.challenger_id, v_challenge.recipient_id)
  order by student.id
  for update;
  get diagnostics v_student_count = row_count;

  if v_student_count <> 2 or (
    select count(*)
    from public.students
    where id in (v_challenge.challenger_id, v_challenge.recipient_id)
      and is_active = true
  ) <> 2 then
    raise exception 'Both students must have active Academy accounts.';
  end if;

  select count(*) into v_challenger_games
  from public.live_chess_games
  where game_mode = 'correspondence' and status = 'active'
    and (
      white_player_id = v_challenge.challenger_id
      or black_player_id = v_challenge.challenger_id
    );
  select count(*) into v_recipient_games
  from public.live_chess_games
  where game_mode = 'correspondence' and status = 'active'
    and (
      white_player_id = v_challenge.recipient_id
      or black_player_id = v_challenge.recipient_id
    );

  if v_challenger_games >= 10 or v_recipient_games >= 10 then
    raise exception 'A player already has 10 active correspondence games.';
  end if;

  if random() < 0.5 then
    v_white_id := v_challenge.challenger_id;
    v_black_id := v_challenge.recipient_id;
  else
    v_white_id := v_challenge.recipient_id;
    v_black_id := v_challenge.challenger_id;
  end if;

  for v_attempt in 1..8 loop
    v_challenge_code := upper(encode(extensions.gen_random_bytes(2), 'hex'));
    begin
      insert into public.live_chess_games(
        challenge_code,
        created_by,
        white_player_id,
        black_player_id,
        status,
        time_control_id,
        time_control,
        initial_fen,
        current_fen,
        active_color,
        white_ms,
        black_ms,
        clock_started_at,
        started_at,
        rated,
        matchmaking,
        game_mode,
        days_per_move,
        turn_deadline_at
      ) values (
        v_challenge_code,
        v_challenge.challenger_id,
        v_white_id,
        v_black_id,
        'active',
        'none',
        jsonb_build_object(
          'id', 'none',
          'name', 'No Clock',
          'initialMs', null,
          'incrementMs', 0
        ),
        v_initial_fen,
        v_initial_fen,
        'white',
        null,
        null,
        null,
        v_now,
        false,
        false,
        'correspondence',
        3,
        v_now + interval '3 days'
      ) returning id into v_game_id;
      exit;
    exception when unique_violation then
      if v_attempt = 8 then
        raise exception 'Could not reserve a correspondence game code. Try again.';
      end if;
    end;
  end loop;

  update public.student_correspondence_challenges
  set status = 'accepted',
      responded_at = v_now,
      recipient_seen_at = coalesce(recipient_seen_at, v_now),
      accepted_game_id = v_game_id
  where id = v_challenge.id;

  return jsonb_build_object(
    'challengeId', v_challenge.id,
    'status', 'accepted',
    'gameId', v_game_id
  );
end;
$$;

create or replace function public.cancel_student_correspondence_challenge(
  p_challenge_id uuid,
  p_challenger_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_challenge public.student_correspondence_challenges%rowtype;
  v_now timestamptz := now();
begin
  select * into v_challenge
  from public.student_correspondence_challenges
  where id = p_challenge_id
  for update;

  if not found then
    raise exception 'Correspondence challenge not found.';
  end if;
  if v_challenge.challenger_id <> p_challenger_id then
    raise exception 'Only the challenger can cancel this challenge.';
  end if;

  if v_challenge.status = 'cancelled' then
    return jsonb_build_object('challengeId', v_challenge.id, 'status', 'cancelled');
  end if;
  if v_challenge.status = 'pending' and v_challenge.expires_at <= v_now then
    update public.student_correspondence_challenges
    set status = 'expired', expired_at = v_now
    where id = v_challenge.id;
    return jsonb_build_object('challengeId', v_challenge.id, 'status', 'expired');
  end if;
  if v_challenge.status <> 'pending' then
    raise exception 'This correspondence challenge is already %.', v_challenge.status;
  end if;

  update public.student_correspondence_challenges
  set status = 'cancelled', cancelled_at = v_now
  where id = v_challenge.id;

  return jsonb_build_object('challengeId', v_challenge.id, 'status', 'cancelled');
end;
$$;

create or replace function public.mark_student_correspondence_challenges_seen(
  p_recipient_id uuid,
  p_challenge_ids uuid[] default null
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_seen_count integer;
begin
  perform public.ensure_student_correspondence_inbox(p_recipient_id);

  update public.student_correspondence_challenges
  set recipient_seen_at = now()
  where recipient_id = p_recipient_id
    and recipient_seen_at is null
    and (p_challenge_ids is null or id = any(p_challenge_ids));

  get diagnostics v_seen_count = row_count;
  return jsonb_build_object('markedSeen', v_seen_count);
end;
$$;

insert into public.student_correspondence_inboxes(student_id)
select id from public.students
where is_active = true
on conflict (student_id) do nothing;

revoke all on function public.ensure_student_correspondence_inbox(uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.expire_student_correspondence_challenges(uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.settle_correspondence_game_deadlines(uuid, uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.create_student_correspondence_challenge(uuid, uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.respond_student_correspondence_challenge(uuid, uuid, text)
  from public, anon, authenticated, service_role;
revoke all on function public.cancel_student_correspondence_challenge(uuid, uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.mark_student_correspondence_challenges_seen(uuid, uuid[])
  from public, anon, authenticated, service_role;

grant execute on function public.ensure_student_correspondence_inbox(uuid) to service_role;
grant execute on function public.expire_student_correspondence_challenges(uuid) to service_role;
grant execute on function public.settle_correspondence_game_deadlines(uuid, uuid) to service_role;
grant execute on function public.create_student_correspondence_challenge(uuid, uuid) to service_role;
grant execute on function public.respond_student_correspondence_challenge(uuid, uuid, text) to service_role;
grant execute on function public.cancel_student_correspondence_challenge(uuid, uuid) to service_role;
grant execute on function public.mark_student_correspondence_challenges_seen(uuid, uuid[]) to service_role;

comment on table public.student_correspondence_challenges is
  'Server-only academy correspondence invitations with seven-day expiry and idempotent acceptance.';
comment on table public.student_correspondence_inboxes is
  'Server-only opaque Realtime capabilities for per-student correspondence invalidations.';

create or replace function public.broadcast_student_correspondence_game_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_white_token uuid;
  v_black_token uuid;
  v_payload jsonb;
begin
  if new.game_mode <> 'correspondence' then
    return null;
  end if;

  select inbox.realtime_token into v_white_token
  from public.student_correspondence_inboxes inbox
  where inbox.student_id = new.white_player_id;

  select inbox.realtime_token into v_black_token
  from public.student_correspondence_inboxes inbox
  where inbox.student_id = new.black_player_id;

  v_payload := jsonb_build_object(
    'gameId', new.id,
    'status', new.status,
    'updatedAt', new.updated_at
  );

  if v_white_token is not null then
    perform realtime.send(
      v_payload,
      'correspondence_changed',
      'student-correspondence:' || new.white_player_id::text || ':' || v_white_token::text,
      false
    );
  end if;

  if v_black_token is not null then
    perform realtime.send(
      v_payload,
      'correspondence_changed',
      'student-correspondence:' || new.black_player_id::text || ':' || v_black_token::text,
      false
    );
  end if;

  return null;
end;
$$;

revoke all on function public.broadcast_student_correspondence_game_change()
  from public, anon, authenticated, service_role;

drop trigger if exists broadcast_student_correspondence_game_change
  on public.live_chess_games;
create trigger broadcast_student_correspondence_game_change
after insert or update on public.live_chess_games
for each row execute function public.broadcast_student_correspondence_game_change();

-- Correspondence games do not occupy the single synchronous-game slot used by
-- live matchmaking. Matchmaking itself always creates live games by default.
create or replace function public.join_live_chess_matchmaking(
  p_student_id uuid,
  p_time_control_id text,
  p_time_control jsonb,
  p_initial_fen text,
  p_challenge_code text,
  p_rated boolean
)
returns table(ticket_id uuid, ticket_status text, game_id uuid)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_ticket_id uuid;
  v_candidate public.live_chess_matchmaking_tickets%rowtype;
  v_game_id uuid;
  v_rating integer;
  v_white_id uuid;
  v_black_id uuid;
  v_now timestamptz := now();
  v_initial_ms bigint;
begin
  if p_time_control_id not in ('10m', '10+5', '15+10') then
    raise exception 'Choose a timed matchmaking clock.';
  end if;
  if not (
    p_challenge_code ~ '^[A-Z0-9]{4}$'
    or p_challenge_code ~ '^[A-HJ-NP-Z2-9]{12}$'
  ) then
    raise exception 'Invalid challenge code.';
  end if;
  if not exists (select 1 from public.students where id = p_student_id and is_active = true) then
    raise exception 'Active student not found.';
  end if;
  if exists (
    select 1 from public.live_chess_games
    where game_mode = 'live'
      and status = 'active'
      and (white_player_id = p_student_id or black_player_id = p_student_id)
  ) then
    raise exception 'Finish your active live game before joining matchmaking.';
  end if;

  update public.live_chess_matchmaking_tickets
  set status = 'expired'
  where status = 'waiting' and created_at < v_now - interval '10 minutes';

  update public.live_chess_matchmaking_tickets
  set status = 'cancelled'
  where student_id = p_student_id and status = 'waiting';

  insert into public.student_chess_ratings(student_id)
  values (p_student_id)
  on conflict (student_id) do nothing;
  select rating into strict v_rating
  from public.student_chess_ratings
  where student_id = p_student_id;

  insert into public.live_chess_matchmaking_tickets(
    student_id, time_control_id, rated, student_rating
  ) values (
    p_student_id, p_time_control_id, p_rated, v_rating
  ) returning id into v_ticket_id;

  select q.* into v_candidate
  from public.live_chess_matchmaking_tickets q
  where q.status = 'waiting'
    and q.id <> v_ticket_id
    and q.student_id <> p_student_id
    and q.time_control_id = p_time_control_id
    and q.rated = p_rated
    and q.created_at >= v_now - interval '10 minutes'
    and not exists (
      select 1 from public.live_chess_games g
      where g.game_mode = 'live'
        and g.status = 'active'
        and (g.white_player_id = q.student_id or g.black_player_id = q.student_id)
    )
  order by abs(q.student_rating - v_rating), q.created_at, q.id
  for update skip locked
  limit 1;

  if not found then
    return query select v_ticket_id, 'waiting'::text, null::uuid;
    return;
  end if;

  if random() < 0.5 then
    v_white_id := v_candidate.student_id;
    v_black_id := p_student_id;
  else
    v_white_id := p_student_id;
    v_black_id := v_candidate.student_id;
  end if;
  v_initial_ms := nullif(p_time_control ->> 'initialMs', '')::bigint;

  insert into public.live_chess_games(
    challenge_code, created_by, white_player_id, black_player_id, status,
    time_control_id, time_control, initial_fen, current_fen, active_color,
    white_ms, black_ms, clock_started_at, started_at, rated, matchmaking
  ) values (
    p_challenge_code, p_student_id, v_white_id, v_black_id, 'active',
    p_time_control_id, p_time_control, p_initial_fen, p_initial_fen, 'white',
    v_initial_ms, v_initial_ms, v_now, v_now, p_rated, true
  ) returning id into v_game_id;

  update public.live_chess_matchmaking_tickets
  set status = 'matched', matched_game_id = v_game_id
  where id in (v_ticket_id, v_candidate.id);

  return query select v_ticket_id, 'matched'::text, v_game_id;
end;
$$;

-- Correspondence uses a fresh invitation instead of synchronous rematch state.
create or replace function public.request_live_chess_rematch(
  p_game_id uuid,
  p_student_id uuid,
  p_challenge_code text
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_game public.live_chess_games%rowtype;
  v_rematch_id uuid;
  v_now timestamptz := now();
begin
  select * into v_game
  from public.live_chess_games
  where id = p_game_id
  for update;

  if not found then
    raise exception 'Live game not found.';
  end if;
  if v_game.game_mode <> 'live' then
    raise exception 'Send a new correspondence challenge instead.';
  end if;
  if v_game.status <> 'completed' then
    raise exception 'Rematches are available after the game is completed.';
  end if;
  if p_student_id <> v_game.white_player_id and p_student_id <> v_game.black_player_id then
    raise exception 'You are not a player in this game.';
  end if;
  if v_game.rematch_game_id is not null then
    return jsonb_build_object('status', 'matched', 'gameId', v_game.rematch_game_id);
  end if;
  if v_game.rematch_requested_by is null then
    update public.live_chess_games
    set rematch_requested_by = p_student_id,
        version = version + 1
    where id = p_game_id;
    return jsonb_build_object('status', 'waiting', 'gameId', null);
  end if;
  if v_game.rematch_requested_by = p_student_id then
    return jsonb_build_object('status', 'waiting', 'gameId', null);
  end if;
  if not (
    p_challenge_code ~ '^[A-Z0-9]{4}$'
    or p_challenge_code ~ '^[A-HJ-NP-Z2-9]{12}$'
  ) then
    raise exception 'Invalid challenge code.';
  end if;
  if exists (
    select 1 from public.live_chess_games g
    where g.game_mode = 'live'
      and g.status = 'active'
      and g.id <> p_game_id
      and (
        g.white_player_id in (v_game.white_player_id, v_game.black_player_id)
        or g.black_player_id in (v_game.white_player_id, v_game.black_player_id)
      )
  ) then
    raise exception 'A player already has another active live game.';
  end if;

  insert into public.live_chess_games(
    challenge_code, created_by, white_player_id, black_player_id, status,
    time_control_id, time_control, initial_fen, current_fen, active_color,
    white_ms, black_ms, clock_started_at, started_at, rated, matchmaking,
    rematch_of_game_id
  ) values (
    p_challenge_code, p_student_id, v_game.black_player_id, v_game.white_player_id, 'active',
    v_game.time_control_id, v_game.time_control, v_game.initial_fen, v_game.initial_fen, 'white',
    nullif(v_game.time_control ->> 'initialMs', '')::bigint,
    nullif(v_game.time_control ->> 'initialMs', '')::bigint,
    case when v_game.time_control ->> 'initialMs' is null then null else v_now end,
    v_now, v_game.rated, false, v_game.id
  ) returning id into v_rematch_id;

  update public.live_chess_games
  set rematch_requested_by = null,
      rematch_game_id = v_rematch_id,
      version = version + 1
  where id = v_game.id;

  return jsonb_build_object('status', 'matched', 'gameId', v_rematch_id);
end;
$$;

revoke all on function public.join_live_chess_matchmaking(uuid, text, jsonb, text, text, boolean)
  from public, anon, authenticated, service_role;
revoke all on function public.request_live_chess_rematch(uuid, uuid, text)
  from public, anon, authenticated, service_role;
grant execute on function public.join_live_chess_matchmaking(uuid, text, jsonb, text, text, boolean)
  to service_role;
grant execute on function public.request_live_chess_rematch(uuid, uuid, text)
  to service_role;

-- Arena availability only considers synchronous live games. Students may keep
-- correspondence games open while joining or being force-paired in an Arena.
create or replace function public.match_internal_arena_student(
  p_tournament_id uuid,
  p_student_id uuid,
  p_challenge_code text,
  p_initial_fen text,
  p_avoid_student_id uuid default null
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_tournament public.internal_arena_tournaments%rowtype;
  v_entry public.internal_arena_entries%rowtype;
  v_candidate public.internal_arena_entries%rowtype;
  v_game_id uuid;
  v_white_id uuid;
  v_black_id uuid;
  v_initial_ms bigint;
  v_now timestamptz := now();
begin
  select * into v_tournament
  from public.internal_arena_tournaments
  where id = p_tournament_id
  for update;

  if not found then raise exception 'Arena tournament not found.'; end if;
  if v_tournament.status = 'scheduled' and v_tournament.starts_at <= v_now and v_tournament.ends_at > v_now then
    update public.internal_arena_tournaments set status = 'active' where id = p_tournament_id;
    v_tournament.status := 'active';
  end if;
  if v_tournament.status <> 'active' or v_tournament.ends_at <= v_now then
    if v_tournament.status = 'active' and v_tournament.ends_at <= v_now then
      update public.internal_arena_tournaments set status = 'finished' where id = p_tournament_id;
    end if;
    raise exception 'This Arena is not accepting new games.';
  end if;
  if p_challenge_code !~ '^[A-Z0-9]{4}$' then raise exception 'Invalid challenge code.'; end if;

  select * into v_entry
  from public.internal_arena_entries
  where tournament_id = p_tournament_id and student_id = p_student_id
  for update;

  if not found or v_entry.status in ('withdrawn', 'finished') then
    raise exception 'Join this Arena before entering matchmaking.';
  end if;
  if v_entry.status = 'playing' and v_entry.current_game_id is not null then
    return jsonb_build_object('status', 'matched', 'gameId', v_entry.current_game_id);
  end if;
  if exists (
    select 1 from public.live_chess_games
    where game_mode = 'live'
      and status = 'active'
      and (white_player_id = p_student_id or black_player_id = p_student_id)
  ) then
    raise exception 'Finish your active live game before entering the Arena queue.';
  end if;

  update public.internal_arena_entries
  set status = 'waiting', current_game_id = null
  where id = v_entry.id;

  select candidate.* into v_candidate
  from public.internal_arena_entries candidate
  where candidate.tournament_id = p_tournament_id
    and candidate.student_id <> p_student_id
    and (p_avoid_student_id is null or candidate.student_id <> p_avoid_student_id)
    and candidate.status = 'waiting'
    and candidate.current_game_id is null
    and not exists (
      select 1 from public.live_chess_games game
      where game.game_mode = 'live'
        and game.status = 'active'
        and (game.white_player_id = candidate.student_id or game.black_player_id = candidate.student_id)
    )
  order by candidate.updated_at, candidate.joined_at, candidate.id
  for update skip locked
  limit 1;

  if not found then
    return jsonb_build_object('status', 'waiting', 'gameId', null);
  end if;

  if random() < 0.5 then
    v_white_id := p_student_id;
    v_black_id := v_candidate.student_id;
  else
    v_white_id := v_candidate.student_id;
    v_black_id := p_student_id;
  end if;
  v_initial_ms := nullif(v_tournament.time_control ->> 'initialMs', '')::bigint;

  insert into public.live_chess_games(
    challenge_code, created_by, white_player_id, black_player_id, status,
    time_control_id, time_control, initial_fen, current_fen, active_color,
    white_ms, black_ms, clock_started_at, started_at, rated, matchmaking,
    arena_tournament_id
  ) values (
    p_challenge_code, p_student_id, v_white_id, v_black_id, 'active',
    v_tournament.time_control_id, v_tournament.time_control, p_initial_fen, p_initial_fen, 'white',
    v_initial_ms, v_initial_ms, v_now, v_now, v_tournament.rated, true,
    p_tournament_id
  ) returning id into v_game_id;

  insert into public.internal_arena_pairings(
    tournament_id, game_id, white_student_id, black_student_id, started_at
  ) values (
    p_tournament_id, v_game_id, v_white_id, v_black_id, v_now
  );

  update public.internal_arena_entries
  set status = 'playing', current_game_id = v_game_id
  where id in (v_entry.id, v_candidate.id);

  return jsonb_build_object('status', 'matched', 'gameId', v_game_id);
end;
$$;

create or replace function public.force_internal_arena_pair(
  p_tournament_id uuid,
  p_first_student_id uuid,
  p_second_student_id uuid,
  p_challenge_code text,
  p_initial_fen text
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_tournament public.internal_arena_tournaments%rowtype;
  v_first public.internal_arena_entries%rowtype;
  v_second public.internal_arena_entries%rowtype;
  v_game_id uuid;
  v_white_id uuid;
  v_black_id uuid;
  v_initial_ms bigint;
  v_now timestamptz := now();
begin
  if p_first_student_id = p_second_student_id then raise exception 'Choose two different students.'; end if;
  if p_challenge_code !~ '^[A-Z0-9]{4}$' then raise exception 'Invalid challenge code.'; end if;

  select * into v_tournament from public.internal_arena_tournaments
  where id = p_tournament_id for update;
  if not found then raise exception 'Arena tournament not found.'; end if;
  if v_tournament.status <> 'active' or v_tournament.ends_at <= v_now then
    raise exception 'This Arena is not accepting new games.';
  end if;

  select * into v_first from public.internal_arena_entries
  where tournament_id = p_tournament_id and student_id = p_first_student_id for update;
  select * into v_second from public.internal_arena_entries
  where tournament_id = p_tournament_id and student_id = p_second_student_id for update;
  if v_first.id is null or v_second.id is null then raise exception 'Both students must join the Arena first.'; end if;
  if v_first.status in ('playing', 'withdrawn', 'finished') or v_second.status in ('playing', 'withdrawn', 'finished') then
    raise exception 'Both students must be available for pairing.';
  end if;
  if exists (
    select 1 from public.live_chess_games
    where game_mode = 'live'
      and status = 'active'
      and (
        white_player_id in (p_first_student_id, p_second_student_id)
        or black_player_id in (p_first_student_id, p_second_student_id)
      )
  ) then
    raise exception 'One of these students already has an active live game.';
  end if;

  if random() < 0.5 then
    v_white_id := p_first_student_id;
    v_black_id := p_second_student_id;
  else
    v_white_id := p_second_student_id;
    v_black_id := p_first_student_id;
  end if;
  v_initial_ms := nullif(v_tournament.time_control ->> 'initialMs', '')::bigint;

  insert into public.live_chess_games(
    challenge_code, created_by, white_player_id, black_player_id, status,
    time_control_id, time_control, initial_fen, current_fen, active_color,
    white_ms, black_ms, clock_started_at, started_at, rated, matchmaking,
    arena_tournament_id
  ) values (
    p_challenge_code, p_first_student_id, v_white_id, v_black_id, 'active',
    v_tournament.time_control_id, v_tournament.time_control, p_initial_fen, p_initial_fen, 'white',
    v_initial_ms, v_initial_ms, v_now, v_now, v_tournament.rated, true,
    p_tournament_id
  ) returning id into v_game_id;

  insert into public.internal_arena_pairings(
    tournament_id, game_id, white_student_id, black_student_id, started_at
  ) values (p_tournament_id, v_game_id, v_white_id, v_black_id, v_now);

  update public.internal_arena_entries
  set status = 'playing', current_game_id = v_game_id
  where id in (v_first.id, v_second.id);

  return jsonb_build_object('status', 'matched', 'gameId', v_game_id);
end;
$$;

revoke all on function public.match_internal_arena_student(uuid, uuid, text, text, uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.force_internal_arena_pair(uuid, uuid, uuid, text, text)
  from public, anon, authenticated, service_role;
grant execute on function public.match_internal_arena_student(uuid, uuid, text, text, uuid)
  to service_role;
grant execute on function public.force_internal_arena_pair(uuid, uuid, uuid, text, text)
  to service_role;

-- Completed-game persistence cannot accidentally relabel a correspondence
-- game as live: the source game is authoritative for reward/quest filtering.
create or replace function public.prepare_internal_chess_game_mode()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_game_mode text;
begin
  if new.source_live_game_id is not null then
    select game.game_mode into v_game_mode
    from public.live_chess_games game
    where game.id = new.source_live_game_id;

    if v_game_mode is not null then
      new.game_mode := v_game_mode;
    end if;
  end if;
  return new;
end;
$$;

revoke all on function public.prepare_internal_chess_game_mode()
  from public, anon, authenticated, service_role;

drop trigger if exists prepare_internal_chess_game_mode on public.internal_chess_games;
create trigger prepare_internal_chess_game_mode
before insert on public.internal_chess_games
for each row execute function public.prepare_internal_chess_game_mode();

-- Correspondence results remain in history/statistics but intentionally earn
-- no Academy XP or coins. Quest evaluators can use the persisted game_mode.
create or replace function public.award_completed_academy_game()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_initial_ms bigint;
  v_increment_ms bigint;
  v_estimated_seconds numeric;
  v_speed text;
  v_xp integer;
  v_student_name text;
  v_result_verb text;
begin
  if new.game_mode = 'correspondence' then
    return new;
  end if;

  v_initial_ms := nullif(new.time_control ->> 'initialMs', '')::bigint;
  v_increment_ms := coalesce(nullif(new.time_control ->> 'incrementMs', '')::bigint, 0);
  v_estimated_seconds := case
    when v_initial_ms is null then null
    else (v_initial_ms + (40 * v_increment_ms)) / 1000.0
  end;

  v_speed := case
    when v_estimated_seconds is not null and v_estimated_seconds <= 479 then 'blitz'
    else 'rapid'
  end;
  v_xp := case
    when v_speed = 'blitz' and new.result = 'win' then 5
    when v_speed = 'blitz' then 2
    when new.result = 'win' then 10
    else 5
  end;
  v_result_verb := case new.result when 'win' then 'won' when 'draw' then 'drew' else 'completed' end;

  select display_name into v_student_name
  from public.students
  where id = new.player_id;

  perform public.record_academy_activity_reward(
    new.player_id,
    'web_game',
    new.id,
    v_xp,
    'Academy ' || v_speed || ' game ' || new.result || '.',
    coalesce(v_student_name, 'A student') || ' ' || v_result_verb || ' an Academy game',
    coalesce(v_student_name, 'A student') || ' earned ' || v_xp::text || ' XP and ' || v_xp::text || ' coins for an Academy ' || v_speed || ' game.',
    coalesce(new.completed_at, now())
  );
  return new;
end;
$$;

revoke all on function public.award_completed_academy_game()
  from public, anon, authenticated, service_role;
