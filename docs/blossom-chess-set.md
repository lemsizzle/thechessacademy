# Blossom Chess Set

The Avatar Store's **Boards & Pieces** category includes Blossom Chess Set for
**400 Academy Coins**. One purchase unlocks the rose-and-lilac board and all 12
matching pearl/plum SVG piece renderers, including promotion choices. Bows and
crown jewels decorate familiar chess silhouettes; no moving sparkles, large
textures, external image services, or new runtime dependencies are used.

Use **Use theme** in the store, or independently choose board/piece themes from
the gear beside games and training boards. Paper stays at 800 coins. Buying either
set never unlocks the other. Preferences keep the existing student-scoped browser
storage key; old Paper choices continue to work. Unequipping a mixed set leaves
the other set's selected board or pieces alone.

## Persistence and rollout

- Apply `supabase/migrations/20260906140733_blossom_chess_set.sql` with the app
  release, after the Paper migration. This inserts one catalog item and does not
  change tables, RLS, grants, equipment, inventory, existing prices or wallets.
- The existing atomic `purchase_avatar_item` RPC enforces the database price,
  coin balance, one-time ownership and purchase ledger. No client price is trusted.
- `GET /api/student/board-themes` fetches all supported set entitlements in one
  bounded, student-filtered query. It retains `ownsPaper` for older tabs, while
  newer clients use the independently validated `ownedThemes` list.
- Themes remain locked when ownership cannot be verified. Board position, move
  handlers, sound, annotations and promotion rules are unchanged.
- No student purchases or shared database changes were made during local testing.
  The catalog migration must be applied before the application release.

## Verification

- Unit coverage: `tests/chess/board-appearance.test.ts` and
  `tests/avatar/board-themes-server.test.ts`.
- Disposable Postgres purchase verification (no shared database connection):
  `node scripts/verify-paper-chess-set.mjs <path-to-@electric-sql/pglite>`.
- Regenerate the store thumbnail: `npx tsx scripts/render-blossom-preview.ts`.
- Verified the actual store/provider/board components with isolated browser
  fixtures: locked → buy for 400 → use, Paper stays locked until separately bought,
  mixed-set reload persistence, account switching, inventory-error fallback,
  keyboard e2–e4, unchanged drawings/position on theme selection, and phone/tablet
  gear bounds. No console warnings or errors were observed. No real coins were spent.
- Full suite: 593 tests passed; type checks and production build passed.
