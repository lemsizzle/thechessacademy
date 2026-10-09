-- Display belongs to an earned badge, so revoking/deleting it removes the display automatically.
alter table public.student_badges add column if not exists is_displayed boolean not null default false;
create unique index if not exists student_badges_one_displayed_per_student
  on public.student_badges(student_id) where is_displayed = true;

create or replace function public.set_student_displayed_badge(p_student_id uuid, p_badge_id uuid)
returns uuid language plpgsql security invoker set search_path = public, pg_temp as $$
begin
  -- Serialize simultaneous choices for this student in a short, server-only transaction.
  perform 1 from public.students where id = p_student_id and is_active = true for update;
  if not found then raise exception 'Student profile is not active'; end if;
  if p_badge_id is not null and not exists (
    select 1 from public.student_badges where student_id = p_student_id and badge_id = p_badge_id
  ) then raise exception 'Badge not earned by this student'; end if;

  update public.student_badges set is_displayed = false
    where student_id = p_student_id and is_displayed = true and badge_id is distinct from p_badge_id;
  if p_badge_id is not null then
    update public.student_badges set is_displayed = true
      where student_id = p_student_id and badge_id = p_badge_id and is_displayed = false;
  end if;
  return p_badge_id;
end;
$$;
revoke all on function public.set_student_displayed_badge(uuid, uuid) from public, anon, authenticated;
grant execute on function public.set_student_displayed_badge(uuid, uuid) to service_role;
