-- All fixtures and games are rolled back, including on a failed assertion.
begin;
set local statement_timeout='30s';
set local role service_role;
do $$
declare a uuid; b uuid; stranger uuid; c uuid; result jsonb; again jsonb; preset record; g public.live_chess_games%rowtype;
begin
  insert into public.students(display_name,public_slug,is_active) values('Online fixture A',gen_random_uuid()::text,true) returning id into a;
  insert into public.students(display_name,public_slug,is_active) values('Online fixture B',gen_random_uuid()::text,true) returning id into b;
  insert into public.students(display_name,public_slug,is_active) values('Online fixture stranger',gen_random_uuid()::text,true) returning id into stranger;
  perform public.touch_student_online(a);
  begin
    perform public.create_student_live_challenge(a,b,'3+2'); raise exception 'ASSERT offline allowed';
  exception when others then if sqlerrm not like '%no longer online%' then raise; end if; end;
  perform public.touch_student_online(b);
  begin
    perform public.create_student_live_challenge(a,a,'3+2'); raise exception 'ASSERT self allowed';
  exception when others then if sqlerrm not like '%yourself%' then raise; end if; end;
  begin
    perform public.create_student_live_challenge(a,b,'none'); raise exception 'ASSERT untimed allowed';
  exception when others then if sqlerrm not like '%timed clock%' then raise; end if; end;
  c:=public.create_student_live_challenge(a,b,'3+2');
  begin
    perform public.create_student_live_challenge(b,a,'3+2'); raise exception 'ASSERT duplicate allowed';
  exception when others then if sqlerrm not like '%already pending%' then raise; end if; end;
  begin
    perform public.respond_student_live_challenge(stranger,c,'accept'); raise exception 'ASSERT unauthorized accept allowed';
  exception when others then if sqlerrm not like '%not allowed%' then raise; end if; end;
  begin
    perform public.respond_student_live_challenge(a,c,'accept'); raise exception 'ASSERT sender accept allowed';
  exception when others then if sqlerrm not like '%not allowed%' then raise; end if; end;
  result:=public.respond_student_live_challenge(b,c,'decline');
  if result->>'status'<>'declined' or exists(select 1 from public.live_chess_games where created_by=a) then raise exception 'ASSERT decline created game'; end if;
  update public.student_live_challenges set created_at=now()-interval '2 minutes' where id=c;
  c:=public.create_student_live_challenge(a,b,'3+2');
  result:=public.respond_student_live_challenge(a,c,'cancel');
  if result->>'status'<>'cancelled' then raise exception 'ASSERT cancel failed'; end if;
  update public.student_live_challenges set created_at=now()-interval '2 minutes' where id=c;
  c:=public.create_student_live_challenge(a,b,'3+2');
  update public.student_live_challenges set expires_at=now()-interval '1 second',created_at=now()-interval '2 minutes' where id=c;
  result:=public.respond_student_live_challenge(b,c,'accept');
  if result->>'status'<>'expired' then raise exception 'ASSERT expiry failed'; end if;
  for preset in select * from (values ('3+2',180000,2000),('5+3',300000,3000),('7+2',420000,2000),('10m',600000,0),('10+5',600000,5000),('15+10',900000,10000)) as controls(id,ms,inc) loop
    c:=public.create_student_live_challenge(a,b,preset.id);
    result:=public.respond_student_live_challenge(b,c,'accept');
    again:=public.respond_student_live_challenge(b,c,'accept');
    if again<>result then raise exception 'ASSERT accept not idempotent'; end if;
    select * into strict g from public.live_chess_games where id=(result->>'gameId')::uuid;
    if g.status<>'active' or g.game_mode<>'live' or g.white_ms<>preset.ms or g.black_ms<>preset.ms
      or (g.time_control->>'incrementMs')::integer<>preset.inc or g.clock_started_at is null
      or g.white_player_id not in (a,b) or g.black_player_id not in (a,b) then raise exception 'ASSERT game shape invalid'; end if;
    perform public.touch_student_online(stranger);
    begin
      perform public.create_student_live_challenge(a,stranger,'3+2'); raise exception 'ASSERT busy player allowed';
    exception when others then if sqlerrm not like '%already playing%' then raise; end if; end;
    update public.live_chess_games set status='cancelled',completed_at=now(),clock_started_at=null where id=g.id;
    update public.student_live_challenges set created_at=now()-interval '2 minutes' where id=c;
  end loop;
  update public.students set is_active=false where id=b;
  begin
    perform public.create_student_live_challenge(a,b,'3+2'); raise exception 'ASSERT archived recipient allowed';
  exception when others then if sqlerrm not like '%active Academy%' then raise; end if; end;
end;
$$;
reset role;
do $$ begin
  if has_table_privilege('anon','public.student_online_presence','SELECT')
    or has_table_privilege('authenticated','public.student_live_challenges','INSERT')
    or has_function_privilege('anon','public.respond_student_live_challenge(uuid,uuid,text)','EXECUTE') then
    raise exception 'ASSERT private data or functions are exposed';
  end if;
end $$;
rollback;
select 'Online challenges: all six clocks, consent, expiry, identity, offline/busy/archive checks and permissions passed; fixtures rolled back' as verification;
