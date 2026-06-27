# Lichess Quest Rules

Lichess Quest Rules turn linked account activity into reviewable quest progress. The app supports game, puzzle, Arena, and rating conditions with daily, weekly, monthly, tournament, or all-time windows.

The default timezone is `America/Vancouver`.

## Tracking

Game quests use the Lichess user game export with `since`, `until`, `rated=true`, and the required performance type. Only finished rated games count. Games under 10 moves are ignored.

Puzzle quests use the authenticated puzzle activity endpoint with the server-side `puzzle:read` token. The app counts attempts, successful solves, accuracy, and mapped academy tactic themes.

Arena quests use already-synced Arena results. Rating quests use the highest recorded established ratings.

## Approval

Completed conditions create `pending_quest_awards`. They do not change student XP or badges during evaluation. A teacher approves or rejects them at `/admin/lichess/quest-awards`.

Approval:

- adds XP
- awards the configured badge once
- records the quest completion
- adds activity and XP history

## Duplicate Prevention

The duplicate key contains student, quest, and source period. Non-repeatable rules complete once. Repeatable rules respect the configured cooldown and allow at most one active award per period.

## Anti-Farming

- game quests count rated games only
- unfinished and aborted games do not count
- games under 10 moves do not count
- large rewards require teacher review
- repeatable quests have daily or weekly cooldowns
- evaluation is limited to 100 games or puzzle activities per request

## Privacy

OAuth tokens remain in HTTP-only encrypted cookies and are read only by server routes. Student pages show summarized counts and evidence, not access tokens or full private activity payloads.

If Lichess is unavailable, mock activity keeps the rule engine testable and is labeled as mock in progress evidence.
