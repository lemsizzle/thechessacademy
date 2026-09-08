-- Disposable fixtures: every write is rolled back, no real students are used.
begin;
set local statement_timeout = '15s';
do $$
declare
  arena uuid; a uuid; b uuid; game uuid; result jsonb; blocked boolean := false;
  expected integer; actual integer; white_score integer; black_score integer; scenario integer;
  fen text := 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
begin
  insert into public.internal_arena_tournaments(name,status,starts_at,ends_at,duration_minutes,time_control_id,time_control)
  values('Temporary pause/Berserk verification','active',now(),now()+interval '1 hour',60,'5+3',
    '{"id":"5+3","name":"5 + 3","initialMs":300000,"incrementMs":3000}') returning id into arena;
  perform public.manage_internal_arena_bot(arena,'add',null,'Test Alpha','knight');
  perform public.manage_internal_arena_bot(arena,'add',null,'Test Beta','knight');
  select id into a from public.internal_arena_bots where tournament_id=arena and name='Test Alpha';
  select id into b from public.internal_arena_bots where tournament_id=arena and name='Test Beta';
  update public.internal_arena_tournaments set pairings_paused=true where id=arena;
  begin
    perform public.match_internal_arena_bot_pair(arena,'ZZQ1',fen,a,b);
  exception when raise_exception then
    if sqlerrm not like '%Arena pairings are paused%' then raise; end if;
    blocked := true;
  end;
  assert blocked, 'Paused Arena allowed a pairing';
  assert not exists(select 1 from public.live_chess_games where arena_tournament_id=arena), 'Pause left an orphan game';
  update public.internal_arena_tournaments set pairings_paused=false where id=arena;

  for scenario in 1..4 loop
    -- Use fresh opponents for independent scoring cases; consecutive rematches are blocked.
    if scenario>1 then
      a := public.manage_internal_arena_bot(arena,'add',null,'Test Alpha '||scenario,'knight');
      b := public.manage_internal_arena_bot(arena,'add',null,'Test Beta '||scenario,'knight');
    end if;
    result := public.match_internal_arena_bot_pair(arena,'ZZQ'||scenario::text,fen,a,b);
    game := (result->>'gameId')::uuid;
    assert game is not null, 'Resume did not allow pairing';
    update public.internal_arena_tournaments set pairings_paused=true where id=arena;
    update public.live_chess_games set white_ms=white_ms-1000,version=version+1 where id=game;
    -- The point threshold is seven moves made by the winning player.
    update public.live_chess_games set
      moves=(select jsonb_agg(jsonb_build_object('color',case when n%2=1 then 'white' else 'black' end)) from generate_series(1,case when scenario=2 then 12 else 14 end) n),
      white_berserk=true,black_berserk=true,status='completed',
      winner_color=case when scenario=4 then null when scenario=3 then 'black' else 'white' end,
      result_reason=case when scenario=4 then 'draw' else 'resignation' end,
      completed_at=now(),clock_started_at=null where id=game;
    perform public.finalize_internal_arena_game(game);
    select white_points,black_points into white_score,black_score from public.internal_arena_pairings where game_id=game;
    expected := case when scenario=2 then 2 when scenario=4 then 1 else 3 end;
    actual := case when scenario=3 then black_score else white_score end;
    assert actual=expected, 'Incorrect Berserk points';
    assert (scenario=4 and black_score=1) or (scenario<>4 and least(white_score,black_score)=0), 'Loser received bonus';
    select sum(score) into actual from public.internal_arena_entries where tournament_id=arena;
    perform public.finalize_internal_arena_game(game);
    assert actual=(select sum(score) from public.internal_arena_entries where tournament_id=arena), 'Retry awarded twice';
    update public.internal_arena_tournaments set pairings_paused=false where id=arena;
  end loop;
end;
$$;
rollback;
