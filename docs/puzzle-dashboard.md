# Student Puzzle Dashboard

## Student experience

Open **Train → Puzzle Dashboard** or `/student/training/dashboard`. The training
mode picker and existing training statistics also link to it.

- Rolling 7-, 30-, 90-day and all-time summaries.
- Played attempts, average level of clean solves, clean-solve percentage and a
  deduplicated replay queue.
- An accessible skill radar plus equivalent theme lists, improvement suggestions
  and strengths. Suggestions need at least five attempts; strengths also require
  at least 70% clean solves.
- Theme and opening breakdowns, filtered/paginated history, and a link to the
  existing adaptive review of the student's own games.
- Private replay boards with hints, keyboard controls, promotion and annotations.
  Only a complete solve without hints or wrong moves clears a replay.
- Replays open directly on the playable board. **Next** skips to the next missed
  or helped puzzle without clearing the current one. Optional **Auto-advance after
  solving** opens the next puzzle after a short pause and stays enabled through
  the sequence. Both respect period/theme/opening filters, span list pages, and
  stop at the end. Turning auto-advance off cancels the pending navigation.

This adapts the useful workflow of the Lichess puzzle dashboard to ChessQuest's
existing data and child-friendly language; it does not import external account
history or claim to calculate Lichess performance ratings.

## Metrics

Original `student_puzzle_attempts` drive all statistics. A clean solve requires
`solved`, `first_try_correct`, zero incorrect moves and zero hints. Helped means
solved but not clean; missed means unfinished. Repeated original attempts count.
Solved level is the mean catalog rating of clean solves, excluding unrated
puzzles. It is not a student chess rating.

Replay status uses the latest original attempt for each active puzzle in the
selected period. A later clean dashboard replay removes it; a newer original
mistake can add it again. Retired puzzles remain in history but cannot be replayed.
Time ranges use attempt start times; displayed dates use academy time (Bangkok).
Mini-games and game-review results keep their own statistics.

## Security and rollout

Apply `20261005030635_puzzle_dashboard_replays.sql` before publishing the code.
It adds only a private per-student/per-puzzle clean-replay marker. RLS is enabled,
browser-role privileges are revoked, and service-role privileges are explicit.
There are no reward or quest triggers. It was verified locally and applied to
production on 2026-10-05 before publishing the application code. The remote
migration version is `20261005085414` (Supabase assigned a deployment timestamp).
Production verification confirms RLS enabled, no anonymous/authenticated table
access, and explicit service-role access. No existing student results changed.

The security advisor's no-policy notice for this table is intentional: it is
server-only, with no browser grants. Existing project-wide notices for
[`pg_net` in the public schema](https://supabase.com/docs/guides/database/database-linter?lint=0014_extension_in_public)
and [Supabase Auth leaked-password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection)
are outside this release and were left unchanged.

The dashboard queries are student-scoped, server-only and keyset-paginated. They
select metadata, never FEN/solution moves. Replay launch checks the signed-in
student's own history and an active catalog puzzle. Answers remain inside the
existing authenticated encrypted session token. Move and hint validation reuse
the existing puzzle engine. Replay completion and abandonment bypass normal
attempt, XP, coin, badge, quest and next-puzzle pipelines.

Before the migration exists, summaries still work and saved replay buttons are
disabled with a clear update notice. Other data failures show a retry message,
not invented zero results.

## Verification

- Full unit suite: 1,059 tests in 174 files, with four workers.
- Repository lint/type check (`next typegen && tsc --noEmit`) and production build pass.
- Local Postgres-compatible migration checks verify keys, foreign keys, cascade,
  RLS, browser-role denial and service-role upsert.
- Production-build browser checks against isolated local fixtures: date filters,
  pagination, theme/result filtering, openings, strengths, empty/error states,
  mobile/tablet/desktop layout, hint-assisted and keyboard clean replays.
- A hinted replay made no progress write. A subsequent clean replay made one
  marker write, reduced the replay count from 13 to 12, and left all 32 original
  attempts unchanged. Normal browser flows had no console warnings/errors.
- Direct-replay follow-up verified manual skipping, auto-advance on/off, cancelling
  a pending advance, filter preservation, keyboard solving and stopping at the last
  puzzle. Phone (390 × 844), tablet (768 × 1024) and desktop checks had no horizontal
  overflow or console errors. The replay grid aligns its children at the top so a
  tall instructions panel cannot shrink the board. No additional migration is needed.

Browser fixtures and migration checks are local verification tools under
`work/puzzle-dashboard/`, not application code or production student records.
