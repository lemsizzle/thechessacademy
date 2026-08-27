-- Durable, server-only chat for the in-app Arena lobby.

create table if not exists public.internal_arena_chat_messages (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.internal_arena_tournaments(id) on delete cascade,
  student_id uuid references public.students(id) on delete set null,
  sender_role text not null,
  sender_name text not null,
  message text not null,
  created_at timestamptz not null default now(),
  constraint internal_arena_chat_sender_role_valid check (sender_role in ('student', 'teacher')),
  constraint internal_arena_chat_sender_shape check (
    (sender_role = 'student' and student_id is not null)
    or (sender_role = 'teacher' and student_id is null)
  ),
  constraint internal_arena_chat_sender_name_length check (char_length(btrim(sender_name)) between 1 and 100),
  constraint internal_arena_chat_message_length check (char_length(btrim(message)) between 1 and 280)
);

create index if not exists internal_arena_chat_tournament_time_idx
  on public.internal_arena_chat_messages(tournament_id, created_at desc, id desc);
create index if not exists internal_arena_chat_student_time_idx
  on public.internal_arena_chat_messages(student_id, created_at desc)
  where student_id is not null;

alter table public.internal_arena_chat_messages enable row level security;

revoke all on table public.internal_arena_chat_messages from public, anon, authenticated, service_role;
grant select, insert, delete on table public.internal_arena_chat_messages to service_role;

create policy "Internal Arena chat is server-only"
on public.internal_arena_chat_messages for all to anon, authenticated
using (false) with check (false);

comment on table public.internal_arena_chat_messages is
  'Lasting, rate-limited lobby chat messages posted through authenticated Academy server routes.';
