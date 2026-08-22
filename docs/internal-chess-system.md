# Internal Chess System

## Scope

The internal chess system provides authenticated computer play, live
student-vs-student games, analysis, studies, guided exercises, history,
performance reporting, and Academy PvP ratings under the student and teacher
portals.

## Architecture

The reusable implementation lives under `chess/`:

- `components/`: board presentation, setup, clocks, players, move history,
  controls, promotion, confirmations, and result UI.
- `engine/`: the Web Worker/UCI boundary for Stockfish.
- `game/`: authoritative rules helpers, result generation, bot/time-control
  configuration, and timestamp-based clock calculations.
- `hooks/`: computer-game orchestration, clock lifecycle, sound, and Stockfish
  lifecycle.
- `persistence/`: server-side validation, replay, normalization, and completed
  game storage.
- `types/`: shared contracts used across the layers.

New game modes reuse `AcademyChessboard`, the `game/` helpers, clock logic,
result types, and the common move representation. Live multiplayer replaces the
computer-turn adapter with authenticated server actions and durable canonical
state. Puzzle mode replaces its move acceptance policy, and review consumes the
stored move/FEN/PGN data.

## Live student games

Private student challenges live under `/student/play/live`. A creator chooses a
color and one of the established time controls, then shares a 12-character
code. The second authenticated student joins that waiting game; a student can
never join their own challenge.

`live_chess_games` is the single source of truth. Its move list, current FEN,
active color, timestamped clock base, draw offer, result, and optimistic version
are only readable or writable by the service role. Next.js routes recheck the
custom Lichess session against the active student row and replay every move with
chess.js before a version-guarded update. Browser roles have no table grants and
an explicit deny policy provides defense in depth.

The database broadcasts a small `game_changed` invalidation on a topic derived
from the game UUID and a separate random UUID. Only participating students
receive that capability topic from the authenticated snapshot route. The event
contains no position, player identity, or secret; clients refetch the canonical
snapshot. A three-second polling fallback plus focus refresh makes the page
resumable when WebSockets are unavailable.

Clocks use the same absolute timestamp model as computer games. The stored
remaining times describe the instant at `clock_started_at`; clients render the
countdown locally, but a move or timeout claim is accepted only after the server
recomputes elapsed time. Completed live games generate normalized PGN and one
`internal_chess_games` row per player, keyed idempotently by the source live game.

## Academy ratings, matchmaking, and rematches

Timed live challenges can be rated or casual. Rated completion calls the
service-only `apply_live_chess_rating` database function after normal game
persistence. It locks the game and both rating profiles, uses a starting rating
of 1200, applies K=40 for the first ten rated games and K=24 thereafter, writes
two immutable ledger events, and stamps the source game. That stamp plus a
unique game/student ledger index makes retries safe.

Quick matchmaking uses short-lived server-only queue tickets. The transaction
matches identical clock/rated settings and selects the closest rating with
`FOR UPDATE SKIP LOCKED`, then marks both tickets and creates the canonical live
game together. Students may cancel while waiting, and stale tickets expire after
ten minutes. A completed-game rematch uses a two-party request handshake and
creates one reversed-color game after both students agree.

Students review their profile, history, and leaderboard at
`/student/play/ratings`. Teachers review and document moderation changes at
`/admin/chess-ratings`. Browser database roles cannot read or mutate rating,
ledger, or queue tables; custom-session API routes use the service client after
student or teacher authorization.

## Board and rules

`react-chessboard@5.10.0` renders the board. It supports drag-and-drop, click to
move, touch, orientation changes, animation, notation, and square styling.
`AcademyChessboard` adds selected-square, legal quiet move, legal capture, last
move, and checked-king indications.

`chess.js@1.4.0` is authoritative for legality, SAN, castling, en passant,
promotion, check/checkmate, stalemate, repetition, fifty-move draws,
insufficient material, FEN, PGN, and move history. UI components do not
reimplement chess rules.

## Stockfish Web Worker

The app pins `stockfish@18.0.8` and serves the unmodified Stockfish 18
`lite single-threaded` JavaScript/WASM pair from `public/vendor/stockfish/`.
The engine always runs inside a dedicated browser Web Worker. No move request
is sent to Lichess, Chess.com, or another external service.

This build was selected because it is the Stockfish.js maintainer's recommended
browser build for most projects: it is much smaller than the full engine,
remains far stronger than the V1 target opponents, works in current desktop and
mobile browsers, and does not need SharedArrayBuffer, cross-origin isolation,
COOP/COEP, or special threading headers.

`StockfishService` owns one worker at a time and exposes initialization,
MultiPV position analysis, move requests, stop, and terminate operations. A
cancelled live search terminates that worker before another position can be
searched. This makes stale analysis and `bestmove` output unable to enter a
takeback or new game. Workers are lazily recreated and terminated on page
unmount.

## Bot configuration

UI names are mapped through `BotDifficulty`; components never depend directly
on raw UCI settings. Stockfish runs at full analysis strength and returns 6-10
ranked candidate lines using the standard UCI `MultiPV` option. Each candidate
records its UCI move, centipawn or mate score, depth, rank, bound, and principal
variation.

`bots/humanMoveSelector.ts` is the human decision layer. It rejects illegal and
wildly implausible candidates, calculates centipawn loss, estimates position
complexity, and scores chess features with the selected personality. Features
include checks, captures, threats, development, central play, castling, king
safety, defense, simplification, knight preference, pawn habits, premature
queen moves, repeated-piece moves, and unforced king moves.

Move quality is configured through weighted centipawn-loss bands. Complexity
raises the weight of larger-error bands, especially for bots with lower
tactical awareness, so mistakes become more likely in positions with captures,
checks, loose material, or exposed kings. Selection then uses a temperature-
weighted choice among candidates in the selected band. It never chooses
uniformly from every legal move and does not force a bad check or random king
move merely to lower strength.

The five initial profiles are:

- Pawny (~375): complete beginner with pawn, edge-pawn, early-queen, and
  repeated-piece habits.
- Zippy Knight (~575): excited attacker who prefers plausible checks, captures,
  threats, and knight moves.
- Benny Bishop (~775): careful learner who values development, the center, and
  castling.
- Rocky Rook (~975): solid defender who favors safety, defense, exchanges, and
  low-risk play.
- Quinn Queen (~1225): balanced club player with the highest quality discipline
  and tactical awareness, while still choosing second- or third-best moves.

The displayed ratings are initial teaching-oriented tuning targets, not measured
Elo. Personality weights, MultiPV count, think time, error bands, tactical
awareness, complexity sensitivity, and selection temperature all live in the
central bot configuration rather than being hard-coded into the selector.

## Clocks

Clock state uses an absolute `startedAt` timestamp and recomputes remaining time
from elapsed wall time. It does not decrement a counter once per render or
interval. A completed move applies increment and changes the active color.
Takeback restores the saved clock snapshot from before the human move. Finished
games pause the clock, and reaching zero generates a timeout result.

## Completed-game persistence and security

Migration `20260815090000_create_internal_chess_games.sql` creates
`public.internal_chess_games` with a foreign key to the existing `students`
table. It stores opponent metadata, color, result/reason, time control, initial
and final FEN, normalized PGN, replayable moves, and timestamps.

The browser posts only to `/api/student/chess-games`; it never writes the table
directly. The route reads the existing HTTP-only Lichess student session,
revalidates it against the active live student row, and supplies the student ID
server-side. The server replays every submitted move with chess.js, rejects
illegal moves or inconsistent final positions/results, and generates normalized
PGN before inserting with the service-role client.

RLS is enabled. `public`, `anon`, and `authenticated` have no table privileges,
and explicit deny policies provide defense in depth. Only `service_role` has
table privileges. No service key or student identity is exposed to the browser.

## Student game history and performance

Authenticated students can open `/student/play/history` from both the Play page
and student navigation. The view combines completed computer and live games in
one newest-first record, with opponent-type and result filters, stable
pagination, lifetime wins/draws/losses, win rate, and computer/live totals.

`/api/student/chess-history` derives the student identity exclusively from the
signed HTTP-only session. Its service-role query selects only the lightweight
list fields needed by the page, applies filters and pagination in Postgres, and
uses exact head counts for the lifetime summary. Full FEN, PGN, and move arrays
remain available through the existing authorized single-game analysis route;
the history response exposes only a calculated move count. Every displayed row
links to the existing game analysis board.

## Teacher chess performance

The teacher can open `/admin/chess-performance` to review internal play across
the active roster. The server-rendered dashboard reports unique completed games,
computer/live mode totals, 30-day activity, class-level participation, and each
student's W–D–L, win rate, last game, and mode split. A completed live game is
stored once per player for personal history, but the teacher summary deduplicates
those two records by `source_live_game_id`.

The page reads lightweight fields in bounded 1,000-row batches through the
server-only service client. It has no browser database client or public API.
Teacher actions link to the existing student editor and authorized analysis
route, and active students with no saved games remain visible for coaching.

Schema changes are applied through reviewed, timestamped Supabase migrations;
application startup never mutates the database.

## Stockfish GPL obligations

Stockfish and Stockfish.js are GNU GPL v3 software. Distribution must include
the license and the complete corresponding source, or a valid pointer to the
exact corresponding source used to build the binary. Local engine changes would
also need to be offered under GPL v3.

This repository includes `public/vendor/stockfish/COPYING.txt` plus
`SOURCE.md`, which records the exact npm version, source repositories, file
hashes, and that the artifacts are unmodified. Keep those files and source
pointers available anywhere the WASM build is distributed. Review GPL
compliance again before changing, rebundling, or commercially distributing a
modified Stockfish build.
