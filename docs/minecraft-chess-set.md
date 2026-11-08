# Minecraft Chess Set

Mythic board-and-pieces bundle priced at 1,000 Academy Coins.
Original code-native voxel artwork: quartz/diamond versus deepslate/amethyst,
gold crowns, creeper-carved rooks and block horse knights. Both kings have cross
crowns, queens have three-point crowns, bishops have split mitres, and the short
cube pawns are intentionally simple. The board alternates light stone and grass.

The existing board-theme purchase entitlement unlocks both selectors, saved
preferences, mix-and-match, promotion pieces and actual-piece store previews.
No external image fetches, SVG filters or animations run per move.

## Release

This implementation was prepared on top of main in an isolated worktree.
The user authorized publication on 2026-11-09.
Deploy the application before publishing the catalog row. Do not activate a
listing that old clients cannot play.

1. Run lint, tests and production build; review the generated board and piece sheet.
2. Verify the What's new date matches the release date in Asia/Bangkok.
3. With user authorization, commit and push the focused changes to main.
4. Verify the deployment and matching public preview, then run
   `node --env-file=<trusted-env-file> --import tsx scripts/publish-minecraft-chess-set.ts --publish`.
5. Verify the public catalog price/rarity and the owned board/piece selectors.

Without `--publish`, the script only prints the catalog manifest. It refuses to
publish unless the deployed preview matches this release, checks public reads,
and refuses to overwrite a conflicting existing item. It makes no wallet,
inventory, RLS or authentication changes.

Regenerate previews with `npx tsx scripts/render-minecraft-preview.ts`.
The public SVG is the store thumbnail; the full board and twelve-piece sheet
under `work/minecraft-chess-set/` are local review artifacts.

## Verification (2026-11-09)

- Lint/TypeScript and optimized production build passed.
- All 1,313 tests across 208 files passed with four workers.
  The initial parallel build/test run hit one unrelated Adventure hint timeout;
  the subsequent suite passed without code changes.
- Reviewed the full starting board and all twelve pieces rendered from the actual
  SVG components. Verified bishops, pawns and both crown types are distinct.
- Dry-run publication manifest confirms Mythic, 1,000 coins, purchase unlock,
  and board_theme category. Live catalog has no conflicting slug or ID.
- React review: renderers are stable module-level components, inherit svgStyle
  for board integration, and add no hooks, requests, effects or animation work.
- Publication follows the application deployment. Verification does not spend a
  real student's coins; purchase authorization and entitlement handling use the
  existing server flow covered by the tests.
