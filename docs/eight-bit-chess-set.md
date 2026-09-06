# 8-Bit Chess Set

Epic, 800 Academy Coins. One purchase unlocks the mint-and-indigo beveled board
and all twelve cream/violet pixel-grid piece renderers, including promotion choices.
Board and pieces can be mixed independently with Academy, Paper and Blossom.
The existing student-scoped ownership and preference checks remain authoritative.

Art is original code-native SVG on a 16-unit grid, with crisp edges and no external
images, animation, filters or additional dependencies. The store preview renders
the same pieces used during play. Regenerate its static thumbnail with
`npx tsx scripts/render-eight-bit-preview.ts`.

## Release

Deploy the app changes and apply `20260906175302_eight_bit_chess_set.sql` together.
Do not enable the live catalog item before the deployed app supports `eightBit`:
older clients do not recognize its entitlement. The migration inserts only this
catalog item and is replay-safe; it does not grant ownership or spend real coins.

Verification includes all twelve renderers, preview identity, price and rarity,
locked fallback, mixed-set persistence and server inventory lookup coverage.
