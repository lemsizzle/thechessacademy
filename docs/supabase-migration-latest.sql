-- Deprecated migration file.
--
-- This project now uses the beginner-friendly setup files:
-- 1. docs/supabase-schema.sql
-- 2. docs/supabase-seed.sql
--
-- This file is intentionally a no-op so it can be run safely by mistake in a
-- fresh Supabase project without creating an older, incompatible table shape.
select
  'Deprecated migration skipped. Run docs/supabase-schema.sql, then docs/supabase-seed.sql.' as message;
