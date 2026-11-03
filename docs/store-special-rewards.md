# Store special rewards

## Student and teacher flow

- Avatar Store → **Get Free Class** → confirm **5,000 coins**. Each purchase creates one pending coupon. The Trophy Case shows a gold **FREE** badge and the available count; multiple purchases stack. Open it to view coupon references and status.
- Teacher Avatar Studio → **Free Class requests** includes direct purchases and Mystery Box wins. Arrange the class with the student, then **Mark redeemed** for that one coupon. **Refund coins** returns the amount actually paid (5,000 for direct purchases; 500 for a box) once and cancels that coupon. Both actions retain history. This feature does not book a class or send a message automatically.
- Avatar Store → **Buy Mystery Box** → confirm **500 coins** → animated chest and prize reveal. Equip immediately or keep the item in inventory. Animation can be skipped and respects reduced motion.
- Mystery items are active, paid, purchasable avatar cosmetics that the student does not own. Board themes/chess sets, defaults, retired and achievement/admin-only items are excluded. Empty pools cannot be purchased. No XP is deducted.
- Each eligible item's weight is `1 / price`. A repeatable FREE class coupon joins the pool with weight `1 / 5000`. Each prize's chance is its weight divided by the total. Won coupons stack with direct purchases in the Trophy Case. The store card describes the prizes without listing individual items. Prices influence drop likelihood, not existing rarity labels. Items can be worth less than the box price. The completed-collection guard remains: at least one unowned cosmetic must be eligible to buy a box, preventing guaranteed 500-coin classes when the collection is complete.

## Persistence and safeguards

Apply `supabase/migrations/20261103105513_store_special_rewards.sql` before releasing the UI. It adds the receipt table and two service-role-only functions; it does not change existing balances, inventory, badges or progress. RLS denies direct browser access.

The follow-up `20261103115233_mystery_box_free_class_prize.sql` adds `prize_kind` separately from the purchased product's `kind`, backfills old receipts, and updates both RPCs. A box coupon remains a 500-coin Mystery Box receipt with a free-class prize and pending status. One atomic receipt prevents duplicate coupons on retries. Applied to production on November 3, 2026 as remote version `20261103160854`; verified complete backfill, RLS, and service-only RPC access.

Purchases authenticate the active student, ignore client-provided identity/price/prize and call `purchase_store_reward`. The database locks the wallet and commits inventory, payment, ledger and receipt together. Mystery rolls occur in the database. A stored request UUID makes retries return the original receipt, even if the purchase response was lost. Recover purchase survives a reload through sessionStorage. A saved reward remains visible if the follow-up wallet refresh fails.

Each coupon has its own pending/fulfilled/refunded status. `resolve_free_class_reward` locks the receipt and allows a single resolution; duplicate refunds cannot pay twice. The student endpoint returns an exact available coupon count independently of its bounded receipt list (recent 20 plus up to 100 pending). Teacher lists show the oldest 100 pending requests first and the newest 100 resolved requests. Resolving pending requests makes room for further ones. Historical records remain in the database.

The Trophy Case fetch is lazy, runs only for the student's own main Trophy Case, and does not add gameplay polling. Release notes are bundled in What's new.

## Verification and local preview

- `node --test tests/store-rewards-db.test.mjs`: actual migration/RPCs in disposable PGlite; stacking, charging, retries, exclusions, exhausted pool, simultaneous requests, refunds, inactive students, role permissions, cost-weighted distribution.
- `npx vitest run tests/avatar/store-rewards-route.test.ts tests/student/whats-new.test.tsx`: real route handlers with mocked dependencies; identity/authorization, input checks, source validation and recoverable errors.
- `npm run lint`, `npx vitest run --maxWorkers=4`, `npm run build`.
- Browser fixture uses real store/coupon/teacher components and an isolated PostgreSQL database. Authentication is stubbed in this local fixture only; route guards are tested separately. It never contacts production APIs.

PowerShell preview:

```powershell
$env:GAMEPLAY_FIXTURE='tests/browser/store-rewards-harness.jsx'
$env:GAMEPLAY_API_FIXTURE='tests/browser/store-rewards-api.mjs'
$env:GAMEPLAY_PORT='9494'
node scripts/serve-gameplay-harness.mjs
```

Open `http://127.0.0.1:9494`. Run `node tests/browser/store-rewards-check.cjs` against a fresh fixture. Screenshots go under `work/store-rewards/`. Checks include purchases/equip, two stacked coupons, teacher redemption/refund, lost-response reload recovery, desktop/tablet/phone layout, reduced motion, and mobile WebKit. Stopping the fixture discards its test data.

Production migration applied on November 3, 2026 as remote version `20261103112341` (`store_special_rewards`), corresponding to local file `20261103105513_store_special_rewards.sql`. Verified RLS and service-only receipt/RPC privileges after application. Browser purchase checks use the isolated fixture; live verification should not spend students' coins for testing.
