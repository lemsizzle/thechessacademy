# Paper Chess Set

The Avatar Studio & Store sells **Paper Chess Set** under **Boards & Pieces** for
800 Academy Coins (Rare). One purchase unlocks the Paper board and all 12 matching
paper-cut piece renderers. Previewing an item is free and does not equip it.

Students can select **Use theme** in the store, or choose board and pieces
independently in the gear menu beside games, analysis and training boards. Academy
remains free. Choices are saved per student on the current browser, not synced to
other devices. Changing themes does not remount the board or change the position.

## Ownership and rollout

- Apply `supabase/migrations/20260906084628_paper_chess_set.sql` together with the
  application release. It extends the existing category constraint and inserts
  one catalog item; it does not grant Paper to existing students.
- The existing service-only `purchase_avatar_item` transaction handles the coin
  deduction, inventory, ledger and duplicate-purchase protection. Purchases require
  an active signed-in student; client-supplied prices and student IDs are ignored.
- `GET /api/student/board-themes` reads the signed-in student's inventory without
  creating wallets or other records. The response is private/no-store. Ownership
  is checked on mount, browser focus and after purchase; preferences cannot unlock
  an unowned set. Guest/teacher contexts without a student provider use Academy.
- `board_theme` items never enter avatar layers or avatar equipment. Existing
  avatars and game/puzzle rules are unchanged. Shared Adventure boards inherit the
  student's chosen appearance as well.
- No new table, RPC, public grants, external images, or image-generation service
  is needed. The paper fibres are CSS and pieces are small original inline SVGs.
- Regenerate the catalog SVG thumbnail with
  `npx tsx scripts/render-paper-preview.ts` after editing the artwork.

## Verification

- Appearance/catalog, all 12 pieces, price/ownership gates, student-scoped storage,
  avatar exclusion, endpoint authentication/error handling and forged purchase
  inputs: `tests/chess/board-appearance.test.ts` and
  `tests/avatar/board-themes-server.test.ts`.
- Local Postgres migration/purchase checks, using an already-installed PGlite:
  `node scripts/verify-paper-chess-set.mjs <path-to-@electric-sql/pglite>`.
  This never connects to production. It checks migration replay, insufficient
  coins, duplicate purchase rejection, 800-coin charging, inventory, RLS and RPC grants.
- Browser checks used the actual provider, store and board components with isolated
  fixture responses: locked → buy → use, mixed themes, reload persistence, switching
  students, keyboard moves, preserved drawings and responsive gear menu at phone,
  tablet and desktop widths. No console errors were observed.

The catalog migration must be applied before the application is deployed.
