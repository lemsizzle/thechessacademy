# Lichess Sync

The app now treats Lichess as one shared sync source instead of letting several pages make their own repeated requests.

## How Sync Works

- Student login can refresh the student's Lichess profile and ratings.
- Quest evaluation fetches game and puzzle activity for active quest windows.
- Vercel Cron can refresh team Arena tournament data through `/api/cron/lichess-team-tournaments`.
- The app stops immediately if Lichess returns `429 Too Many Requests`.
- If the optional `lichess_sync_state` table exists, cooldown state is stored in Supabase so Vercel remembers it across requests.
- `student_lichess_accounts` stores one private, server-owned account snapshot per student. Its first-login counters are reused by student pages, teacher pages, XP, coins, and quests.
- Rapid and Blitz game history is requested together, reducing Lichess API calls and rate-limit pressure.
- If detailed game history is temporarily rate-limited, the persisted baseline still lets profile totals award played-game XP and coins. Win bonuses wait for a successful detail sync.
- Existing quest progress is preserved when a fresh Lichess request fails or is rate-limited.

## Rate Limits

When Lichess returns 429, the app:

- reads `Retry-After` when Lichess sends it
- otherwise waits at least 60 seconds
- stores `next_allowed_sync_at`
- skips sync attempts during cooldown
- shows a friendly cooldown message

Do not keep pressing sync after a 429. Wait for the cooldown message to pass.

## Supabase Migrations

Run this once in Supabase SQL Editor:

```sql
-- docs/supabase-lichess-sync-migration.sql
```

This adds `lichess_sync_state`. It does not delete or change existing student, XP, badge, or quest data.

The versioned migration `supabase/migrations/20260720015734_persist_student_lichess_accounts.sql` adds the private account snapshot used to keep every view consistent. It does not store OAuth tokens.

## Debugging

Teacher-only debug endpoint:

```text
/api/admin/lichess/debug?studentId=STUDENT_UUID
```

It returns safe information only:

- whether required environment variables exist
- the selected student's last sync state
- current cooldown timing

It never returns API keys, Lichess tokens, or Supabase service keys.

## Required Vercel Variables

- `NEXT_PUBLIC_APP_URL`
- `CRON_SECRET`
- `LICHESS_CLIENT_ID`
- `LICHESS_REDIRECT_URI`
- `LICHESS_ENCRYPTION_SECRET`
- `LICHESS_TEAM_ID`
- `LICHESS_TOURNAMENT_SYNC_INTERVAL_MINUTES`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` or `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
