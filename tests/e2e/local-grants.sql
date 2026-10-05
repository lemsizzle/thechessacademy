-- LOCAL TEST PROJECT ONLY. The original pre-migration schema and Academy
-- credential migration relied on Supabase's old automatic service grants.
-- This explicit compatibility bridge is not a production migration.
grant usage on schema public to service_role;
grant select, insert, update, delete on public.students to service_role;
grant select, insert, update, delete on public.student_login_credentials to service_role;
revoke all on public.student_login_credentials from public, anon, authenticated;
