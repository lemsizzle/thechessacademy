-- Private mapping. No email addresses or Google profile data enter public student records.
create table public.student_registration_accounts (
  auth_user_id uuid primary key references auth.users(id) on delete cascade,
  student_id uuid not null unique references public.students(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.student_registration_accounts enable row level security;
revoke all on public.student_registration_accounts from public, anon, authenticated;
grant select, insert, update, delete on public.student_registration_accounts to service_role;

-- Called only by the trusted server after Supabase has verified the identity.
-- Transaction and per-identity lock prevent duplicate students from concurrent callbacks.
create function public.provision_registered_student(p_auth_user_id uuid, p_nickname text)
returns table(student_id uuid, display_name text)
language plpgsql security invoker set search_path = '' as $$
declare v_id uuid; v_name text; v_active boolean;
begin
  if p_auth_user_id is null then raise exception 'Missing identity'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_auth_user_id::text, 0));
  select s.id, s.display_name, s.is_active into v_id, v_name, v_active
    from public.student_registration_accounts a join public.students s on s.id=a.student_id
    where a.auth_user_id=p_auth_user_id;
  if v_id is not null then
    if v_active is distinct from true then raise exception 'Student inactive'; end if;
    return query select v_id, v_name;
    return;
  end if;
  v_id := gen_random_uuid();
  v_name := coalesce(nullif(left(trim(p_nickname), 40), ''), 'Chess Explorer');
  insert into public.students(id, display_name, public_slug, class_group, total_xp, level, is_active, lichess_id, lichess_username)
    values(v_id, v_name, 'player-' || replace(v_id::text, '-', ''), 'Unassigned', 0, 1, true, null, null);
  insert into public.student_registration_accounts(auth_user_id, student_id) values(p_auth_user_id, v_id);
  return query select v_id, v_name;
end;
$$;
revoke all on function public.provision_registered_student(uuid,text) from public, anon, authenticated;
grant execute on function public.provision_registered_student(uuid,text) to service_role;

create function public.verify_registered_student(p_student_id uuid, p_auth_user_id uuid)
returns boolean language sql stable security invoker set search_path = '' as $$
  select exists(select 1 from public.student_registration_accounts a
    join public.students s on s.id=a.student_id
    where a.auth_user_id=p_auth_user_id and a.student_id=p_student_id and s.is_active is true);
$$;
revoke all on function public.verify_registered_student(uuid,uuid) from public, anon, authenticated;
grant execute on function public.verify_registered_student(uuid,uuid) to service_role;
