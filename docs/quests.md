# Quests

The app supports classroom/manual quests, automated Chess Academy activity
quests, and Lichess Quest Rules.

Teachers manage every quest at `/admin/quests`. The Tracking selector includes
Academy Games, Academy Puzzles, Lichess Games, Lichess Puzzles, Lichess Arena,
and manual completion. The separate `/admin/quests/lichess-rules` screen remains
available for legacy Lichess-only rule editing.

Students see live quests and private activity progress at `/student/quests`.
They explicitly start a quest before activity counts and use Refresh Quest
Progress to re-evaluate it.

## Chess Academy activity

Academy game quests use completed rows from `internal_chess_games`. Teachers can
count all completed games or wins, and can narrow either goal to computer games
or student-vs-student live games.

Academy puzzle quests use server-verified rows from
`student_puzzle_attempts`. Teachers can count attempts, solves, first-try
solves, tactic-theme solves, or require a minimum attempt count and accuracy.
Puzzle answers remain server-only.

Both sources are evaluated only inside the student's active quest window. The
server loads lightweight fields through service-role access, paginates beyond
Supabase's 1,000-row response limit, and returns only summarized progress and
evidence. A Lichess cooldown does not block Academy activity from refreshing.
No schema change is required because quest source and condition fields are
already extensible text columns.

## Completion links

Academy game and puzzle presets link students directly to `/student/play` and
`/student/training`. Only `/student/...` internal paths or validated HTTPS
external links are rendered on quest cards.
