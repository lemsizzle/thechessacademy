-- All students, bots and games here are disposable; every write rolls back.
begin;
set local statement_timeout = '20s';
set local role service_role;
do $$
declare
  arena uuid; other_arena uuid; game uuid; person uuid; result jsonb;
  ids uuid[]; entries uuid[]; is_bot boolean[];
  kind text; code text; step integer; n integer; left_index integer; right_index integer;
  waiting_index integer; rejected boolean; before_count integer; other_entry_a uuid; other_entry_b uuid;
  fen text := 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
begin
  foreach kind in array array['human','mixed','bots'] loop
    insert into public.internal_arena_tournaments(name,status,starts_at,ends_at,duration_minutes,time_control_id,time_control)
    values('Temporary no-repeat verification','active',now(),now()+interval '1 hour',60,'10m',
      '{"id":"10m","name":"10 min","initialMs":600000,"incrementMs":0}') returning id into arena;
    ids := array[]::uuid[]; entries := array[]::uuid[];
    is_bot := case kind when 'human' then array[false,false,false,false]
      when 'mixed' then array[false,true,true,false] else array[true,true,true,true] end;
    for n in 1..4 loop
      if is_bot[n] then
        person := public.manage_internal_arena_bot(arena,'add',null,'Test bot '||n,'knight');
      else
        insert into public.students(display_name,public_slug,is_active)
        values('Temporary pairing test','pairing-test-'||gen_random_uuid()::text,true) returning id into person;
        insert into public.internal_arena_entries(tournament_id,student_id,status) values(arena,person,'waiting');
      end if;
      ids := array_append(ids,person);
      entries := array_append(entries,(select id from public.internal_arena_entries
        where tournament_id=arena and (student_id=person or bot_id=person)));
    end loop;
    update public.internal_arena_entries set status='withdrawn' where id in (entries[3],entries[4]);
    assert public.arena_entries_can_pair(arena,entries[1],entries[2]), 'New opponents were blocked';
    assert not public.arena_entries_can_pair(arena,entries[1],entries[1]), 'Self pairing was allowed';
    assert not public.arena_entries_can_pair(gen_random_uuid(),entries[1],entries[2]), 'Cross-tournament entries were allowed';

    -- A-B, one of them vs C, the other vs D, then A-B is allowed again.
    for step in 1..4 loop
      select candidate into code from (
        select upper(substr(replace(gen_random_uuid()::text,'-',''),1,4)) candidate from generate_series(1,30)
      ) codes where not exists(select 1 from public.live_chess_games where challenge_code=candidate) limit 1;
      assert code is not null, 'Could not reserve a disposable challenge code';
      if step=2 then
        select count(*) into before_count from public.internal_arena_pairings where tournament_id=arena;
        -- Simulates a fresh request/reload with no avoid-opponent parameter.
        for n in 1..2 loop
          if kind='human' then result := public.match_internal_arena_student(arena,ids[1],code,fen);
          elsif kind='mixed' then result := public.match_internal_arena_bot(arena,ids[1],code,fen);
          else result := public.match_internal_arena_bot_pair(arena,code,fen); end if;
          assert result->>'status'='waiting', 'Only the previous opponent was available, but a rematch was created';
        end loop;
        -- Teacher-forced choices must also respect the rule, regardless of color/order.
        rejected := false;
        begin
          if kind='human' then perform public.force_internal_arena_pair(arena,ids[2],ids[1],code,fen);
          elsif kind='mixed' then perform public.match_internal_arena_bot(arena,ids[1],code,fen,ids[2]);
          else perform public.match_internal_arena_bot_pair(arena,code,fen,ids[2],ids[1]); end if;
        exception when raise_exception then
          if sqlerrm not like '%opponent%' and sqlerrm not like '%pairing%' then raise; end if;
          rejected := true;
        end;
        assert rejected, 'Explicit pairing bypassed the consecutive-opponent rule';
        assert before_count=(select count(*) from public.internal_arena_pairings where tournament_id=arena), 'Rejected rematch left a pairing';
        assert before_count=(select count(*) from public.live_chess_games where arena_tournament_id=arena), 'Rejected rematch left an orphan game';
        update public.internal_arena_entries set status='waiting' where id=entries[3];
        if kind='human' then result := public.match_internal_arena_student(arena,ids[1],code,fen);
        elsif kind='mixed' then result := public.match_internal_arena_bot(arena,ids[1],code,fen);
        else result := public.match_internal_arena_bot_pair(arena,code,fen); end if;
        game := (result->>'gameId')::uuid;
        assert game is not null, 'Did not search beyond the previous opponent for an available alternative';
        assert exists(select 1 from public.internal_arena_entries where id=entries[3] and current_game_id=game), 'Alternative opponent was not selected';
        waiting_index := case when exists(select 1 from public.internal_arena_entries where id=entries[1] and current_game_id=game) then 2 else 1 end;
      else
        left_index := case when step=3 then waiting_index else 1 end;
        right_index := case when step=3 then 4 else 2 end;
        if step=3 then update public.internal_arena_entries set status='waiting' where id=entries[4]; end if;
        if step=4 then
          assert public.arena_entries_can_pair(arena,entries[1],entries[2]), 'Both played different opponents but a later rematch stayed blocked';
        end if;
        if is_bot[left_index] and is_bot[right_index] then
          result := public.match_internal_arena_bot_pair(arena,code,fen,ids[left_index],ids[right_index]);
        elsif not is_bot[left_index] and not is_bot[right_index] then
          result := public.force_internal_arena_pair(arena,ids[left_index],ids[right_index],code,fen);
        else
          result := public.match_internal_arena_bot(arena,
            case when is_bot[left_index] then ids[right_index] else ids[left_index] end,code,fen,
            case when is_bot[left_index] then ids[left_index] else ids[right_index] end);
        end if;
        game := (result->>'gameId')::uuid;
        assert game is not null, 'An eligible pairing was not created';
      end if;

      update public.live_chess_games set status='completed',winner_color='white',result_reason='resignation',
        completed_at=now(),clock_started_at=null where id=game;
      -- Distinct historical timestamps inside this single transaction (now() is constant).
      update public.internal_arena_pairings set started_at=now()-interval '1 hour'+step*interval '1 second' where game_id=game;
      perform public.finalize_internal_arena_game(game);
      if step in (1,2) then
        assert not public.arena_entries_can_pair(arena,entries[1],entries[2]), 'Must check BOTH participants last opponent';
        assert not public.arena_entries_can_pair(arena,entries[2],entries[1]), 'Swapping colors bypassed the rule';
      end if;
    end loop;

    if kind='human' then
      insert into public.internal_arena_tournaments(name,status,starts_at,ends_at,duration_minutes,time_control_id,time_control)
      values('Temporary independent Arena verification','active',now(),now()+interval '1 hour',60,'10m',
        '{"id":"10m","name":"10 min","initialMs":600000,"incrementMs":0}') returning id into other_arena;
      insert into public.internal_arena_entries(tournament_id,student_id) values(other_arena,ids[1]) returning id into other_entry_a;
      insert into public.internal_arena_entries(tournament_id,student_id) values(other_arena,ids[2]) returning id into other_entry_b;
      assert public.arena_entries_can_pair(other_arena,other_entry_a,other_entry_b), 'Another tournament inherited the restriction';
    end if;
  end loop;
end;
$$;
rollback;
