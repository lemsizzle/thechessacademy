# Supabase Next Steps

1. Review and run `docs/supabase-migration-latest.sql`.
2. Add Row Level Security policies.
3. Keep public read access limited to safe student progress data.
4. Restrict all admin mutations to authenticated teacher accounts.
5. Create a Supabase Storage bucket for badge art.
6. Replace mock imports in `data/` with server-side Supabase fetch helpers.
7. Move admin dashboard actions into server actions so writes are validated on the server.
8. Replace mock student login with Supabase Auth and a `profiles` table.
9. Move student submission writes into server actions or route handlers that verify the current user.
10. Store encrypted Lichess OAuth tokens in `student_lichess_accounts.access_token_encrypted`.
11. Add a `student_auth_accounts` table with a unique provider/provider_user_id constraint.
12. Add Arena tournament, result, and pending award tables for the teacher approval workflow.

## Student Access RLS Goals

- Public users cannot read private submission tables.
- Students can read only submissions where `student_id` matches their profile.
- Students can insert submissions only for their own `student_id`.
- Students cannot update review fields, status, XP awards, or tactic progress awards.
- Admin users can read and update all submissions.
- Admin-only routes should verify role server-side, not only in the browser.
- Lichess-linked students should only be able to access their own profile, submissions, and sync endpoint.

## Suggested Storage Buckets

- `badge-art`: generated and selected badge images.
- `student-avatars`: optional future profile images.

## Tournament Sync

- Move Arena tournament cache writes into `lichess_arena_tournaments`.
- Store final standings in `lichess_arena_tournament_results`.
- Store calculated XP in `pending_tournament_awards` until a teacher approves or rejects it.
- Persist `team_sync`, `imported_url`, and `manual_fallback` as tournament source values.
- Keep imported Arenas private unless `is_public` is explicitly enabled by an admin.
- Keep Lichess sync in server routes only.
- Let students read active upcoming and ongoing tournaments.
- Restrict manual fallback tournament edits to admin users.
- Treat any old Swiss columns or tables as deprecated and unused; do not drop them automatically.

## Lichess Quest Rules

- Store quest conditions on `quests`.
- Persist evaluation evidence in `lichess_activity_snapshots`.
- Create `pending_quest_awards` before changing XP or badges.
- Record approved rewards in `quest_completion_events`.
- Run evaluation in server jobs with encrypted Lichess tokens and rate-limit backoff.

## Environment Variables

Use `.env.local` locally and never expose service-role or OpenAI keys to client components.
