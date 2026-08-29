-- The hosted pgcrypto extension exposes gen_random_bytes from the extensions
-- schema. Keep the service-role-only invoker function on a fixed, trusted
-- search path so already-deployed copies resolve that function safely.

alter function public.respond_student_correspondence_challenge(uuid, uuid, text)
  set search_path = pg_catalog, extensions;
