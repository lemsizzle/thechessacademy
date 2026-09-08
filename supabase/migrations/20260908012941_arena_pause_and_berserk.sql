-- Backward-compatible defaults keep existing games and tournaments unchanged.
alter table public.internal_arena_tournaments add column if not exists pairings_paused boolean not null default false;
alter table public.live_chess_games add column if not exists white_berserk boolean not null default false;
alter table public.live_chess_games add column if not exists black_berserk boolean not null default false;
alter table public.internal_arena_pairings drop constraint if exists internal_arena_pairing_points_valid;
alter table public.internal_arena_pairings add constraint internal_arena_pairing_points_valid
  check (white_points between 0 and 3 and black_points between 0 and 3);

-- All pairing paths insert a live game in the same transaction. Lock the Arena
-- row before allowing that insert so a concurrent teacher pause is authoritative.
create or replace function public.guard_arena_pairings_pause()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare paused boolean;
begin
  if new.arena_tournament_id is not null then
    select pairings_paused into paused from public.internal_arena_tournaments
    where id = new.arena_tournament_id for update;
    if paused then raise exception 'Arena pairings are paused by the teacher.'; end if;
  end if;
  return new;
end;
$$;
revoke all on function public.guard_arena_pairings_pause() from public, anon, authenticated;
grant execute on function public.guard_arena_pairings_pause() to service_role;
drop trigger if exists guard_arena_pairings_pause on public.live_chess_games;
create trigger guard_arena_pairings_pause before insert on public.live_chess_games
for each row execute function public.guard_arena_pairings_pause();

-- Keep the existing idempotent finalizer and bot/student accounting intact.
-- Only change its win points; draws and losses never receive a Berserk bonus.
do $migration$
declare definition text;
begin
  select pg_get_functiondef('public.finalize_internal_arena_game(uuid)'::regprocedure) into definition;
  if position('v_game.white_berserk' in definition) = 0 then
    if position('v_white_points := 2;' in definition) = 0 or position('v_black_points := 2;' in definition) = 0 then
      raise exception 'Unexpected Arena finalizer: review scoring before applying Berserk.';
    end if;
    definition := replace(definition, 'v_white_points := 2;',
      'v_white_points := 2 + case when v_game.white_berserk and (select count(*) from jsonb_array_elements(v_game.moves) as m where m->>''color'' = ''white'') >= 7 then 1 else 0 end;');
    definition := replace(definition, 'v_black_points := 2;',
      'v_black_points := 2 + case when v_game.black_berserk and (select count(*) from jsonb_array_elements(v_game.moves) as m where m->>''color'' = ''black'') >= 7 then 1 else 0 end;');
    execute definition;
  end if;
end;
$migration$;
