# Sir Lem — So_Pawny repertoire mirror

Sir Lem uses public rated standard games from the Lichess account `so_pawny`.
He is a repertoire-based imitation, not a trained neural clone or an exact
prediction of the player's decisions in positions absent from the archive.

## Move selection

1. Load the repertoire lazily when Sir Lem first needs a move. The lobby and
   other bots import only the small profile metadata, not the game archive.
2. Match the actual board by canonical FEN: pieces, side to move, castling rights,
   and legal en-passant rights. Ignore only move counters. Transpositions and
   reloaded games therefore use the same memory without needing a move list.
3. Validate the remembered moves against the current legal moves and sample the
   source player's recorded choices. Each game's weight halves every 180 days
   relative to the newest exported game. Raw sample counts are also retained.
4. In unfamiliar positions, use the existing style-inspired Stockfish selector.
   Known repertoire moves are not subject to its shortlist, centipawn-loss
   filters, artificial error bands, or personality bonuses.

The old implementation merely gave a bonus to an exact-history opening move
*if Stockfish happened to shortlist it*. Its random error-band filter could
then discard that move. This made the supposed mirror play unrelated moves.

## Building the profile

```powershell
npm run update:sir-lem-bot
# Reproduce from a previously downloaded public NDJSON export:
npm run update:sir-lem-bot -- --from C:\path\to\games.ndjson
```

The importer requests up to 5,000 public rated standard games, both wins and
losses, from the [Lichess game export API](https://lichess.org/api#tag/Games/operation/apiGamesUser).
It samples only So_Pawny's turns through 80 plies (40 full moves), deduplicates
game IDs and repeated positions within each game, and combines transpositions.
Positions need support from at least two distinct games; all observed move
choices in those positions are kept. No opponent names or game IDs are shipped
in the generated profile. API failures, malformed exports, and insufficient
archives must not replace the known-good profile.

Generated outputs are `chess/bots/sirLemProfile.ts` (metadata) and
`chess/bots/sirLemRepertoire.ts` (position-indexed moves). Updates are committed
and deployed with the app; no Lichess API call occurs during gameplay.

Estimated rating remains a difficulty label, not a measured clone strength.
The other five bots, gameplay rules, rewards, and unlock IDs are unchanged.
