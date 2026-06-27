# Lichess Game Tactic Analyzer

The Game Analyzer is an admin-only tool at `/admin/game-analyzer`.

## Workflow

1. Paste a Lichess game URL, such as `https://lichess.org/abcdefgh`.
2. Choose the student.
3. Choose the student's color or leave it on Auto.
4. Click Analyze Game.
5. The server validates the URL and fetches only the Lichess export endpoint for that game ID.
6. The app replays legal moves with `chess.js`.
7. Rule-based signals find possible tactics.
8. AI, or mock AI when `OPENAI_API_KEY` is missing, explains each candidate.
9. The teacher approves, rejects, edits the tactic theme, or manually adds a finding.

## URL Safety

The app rejects non-Lichess URLs. It extracts the game ID, then calls Lichess server-side using the game ID. It does not fetch arbitrary pasted URLs.

## Detection

The MVP uses rule-based signals:
- check
- checkmate
- captures
- capture with check
- knight fork-like signals

This is not perfect. Findings are candidates until the teacher approves them.

## AI Explanations

AI receives only the position before/after, the move, tactic theme, confidence, and student color. It must return conservative JSON. If `OPENAI_API_KEY` is missing, mock explanations keep the UI functional.

## Badge Progress

Approved findings count toward the same tactic badge thresholds as puzzle progress. They do not grant direct per-game XP. Existing badge threshold rewards still apply.

## Future Upgrade

Stockfish can be added later for stronger candidate detection and eval-swing checks. Keep engine output behind teacher approval.

## Privacy

Game analysis is admin-only by default. Do not show full analysis publicly unless parents/students have consented.
