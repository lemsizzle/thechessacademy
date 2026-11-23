# Minions Chess Set

Mythic board-and-pieces bundle, 1,000 Academy Coins. Catalog ID:
`98be0000-0000-4000-8000-000000000006`; slug: `minions-chess-set`.

Original inline SVG artwork: yellow Minions versus purple rivals, goggles,
overalls, pale versus dark plinths, and a banana-yellow/navy board. Pawns are
short and round; knights retain a horse silhouette; bishops have split mitres;
rooks have battlements; queens have pointed crowns and kings have crosses.
All twelve pieces, including promotion choices, use the shared theme registry.
Board and piece preferences may be mixed with other purchased themes.

The existing authenticated inventory query and atomic purchase path enforce
ownership and the database price. The bundle is not a free starter item.

## Preview and verification

- `node --import tsx scripts/render-minions-preview.ts` regenerates the public
  store thumbnail and local piece/board inspection sheets from playable artwork.
- `node --import tsx scripts/publish-minions-chess-set.ts` displays the catalog
  manifest without writing data.
- Run `npm run lint`, `npx vitest run --maxWorkers=4`, and `npm run build`.
- Relevant coverage: `tests/chess/minions-theme.test.ts`,
  `tests/avatar/board-themes-server.test.ts`, `tests/student/whats-new.test.tsx`.

## Release

Code and catalog must release together. After an explicitly authorized push to
main, verify the production deployment contains the playable Minions theme.
Then run the publisher with trusted server environment values and `--publish`.
It compares the deployed thumbnail with the local file before inserting the
catalog row, refuses to overwrite a conflicting row, and verifies public reads.
No schema migration or Storage upload is needed for code-native SVG pieces.
If releasing after November 23, update the new release note's date to the actual
first-available date in Asia/Bangkok before pushing.
