create table public.academy_class_settings (
  singleton boolean primary key default true check (singleton),
  groups jsonb not null default '[]'::jsonb check (jsonb_typeof(groups) = 'array'),
  revision integer not null default 0,
  updated_at timestamptz not null default now()
);
insert into public.academy_class_settings(singleton) values(true);
alter table public.academy_class_settings enable row level security;
revoke all on public.academy_class_settings from anon, authenticated;
grant all on public.academy_class_settings to service_role;

create table public.academy_class_import_backups (
  fingerprint text primary key,
  groups jsonb not null,
  created_at timestamptz not null default now()
);
alter table public.academy_class_import_backups enable row level security;
revoke all on public.academy_class_import_backups from anon, authenticated;
grant all on public.academy_class_import_backups to service_role;

create function public.save_academy_classes(p_groups jsonb, p_revision integer, p_import boolean default false, p_backup jsonb default null)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare old_groups jsonb; current_revision integer;
begin
  if jsonb_typeof(p_groups) is distinct from 'array' or jsonb_array_length(p_groups) > 200 then
    raise exception 'Invalid class list';
  end if;
  if exists(select 1 from jsonb_array_elements(p_groups) g where nullif(btrim(g->>'id'),'') is null or nullif(btrim(g->>'name'),'') is null or g->>'name' = 'Unassigned')
    or (select count(*) from jsonb_array_elements(p_groups)) <> (select count(distinct lower(g->>'name')) from jsonb_array_elements(p_groups) g)
    or (select count(*) from jsonb_array_elements(p_groups)) <> (select count(distinct g->>'id') from jsonb_array_elements(p_groups) g) then
    raise exception 'Class names and IDs must be unique and nonempty';
  end if;
  select groups, revision into old_groups, current_revision from public.academy_class_settings where singleton for update;
  if p_import and p_backup is not null then
    insert into public.academy_class_import_backups(fingerprint,groups) values(md5(p_backup::text),p_backup) on conflict do nothing;
  end if;
  if p_import and current_revision > 0 then
    return jsonb_build_object('groups',old_groups,'revision',current_revision,'imported',false);
  end if;
  if p_revision is distinct from current_revision then raise exception 'Class settings changed in another tab. Reload classes before saving.' using errcode='40001'; end if;
  if not p_import then
    -- One update handles swaps and renames without matching a renamed row twice.
    update public.students s set class_group = coalesce(n.g->>'name','Unassigned')
    from jsonb_array_elements(old_groups) o(g)
    left join jsonb_array_elements(p_groups) n(g) on n.g->>'id'=o.g->>'id'
    where s.class_group=o.g->>'name' and s.class_group is distinct from coalesce(n.g->>'name','Unassigned');
  end if;
  update public.academy_class_settings set groups=p_groups, revision=revision+1, updated_at=now() where singleton;
  return jsonb_build_object('groups',p_groups,'revision',current_revision+1,'imported',p_import);
end;
$$;
revoke all on function public.save_academy_classes(jsonb,integer,boolean,jsonb) from public,anon,authenticated;
grant execute on function public.save_academy_classes(jsonb,integer,boolean,jsonb) to service_role;
