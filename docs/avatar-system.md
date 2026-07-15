# Avatar Creator and Academy Armory

This app now has a Supabase-backed avatar creator, cosmetic store, inventory, and Academy Coins wallet.

## What Was Added

- Student page: `/student/avatar`
- Student page: `/student/armory`
- Teacher page: `/admin/avatar`
- Secure student purchase route: `/api/student/avatar/purchase`
- Secure student avatar save route: `/api/student/avatar`
- Teacher item/grant/wallet routes under `/api/admin/avatar-items` and `/api/admin/wallets`
- SQL setup file: `/docs/supabase-avatar-system.sql`

## Supabase Setup

1. Open your Supabase project.
2. Go to SQL Editor.
3. Open `/docs/supabase-avatar-system.sql` from this project.
4. Paste it into Supabase SQL Editor.
5. Run it once.
6. Check these tables in Table Editor:
   - `avatar_items`
   - `student_inventory`
   - `student_avatar`
   - `student_wallets`
   - `coin_transactions`
   - `store_purchases`

The SQL file is written to be safe after the existing schema. It does not drop tables or delete data.

## Academy Coins

Lifetime XP is still used for levels, badges, rankings, and progress.

Academy Coins are separate spendable currency:

- Earning 50 XP also grants 50 Academy Coins.
- Spending 150 coins does not reduce lifetime XP.
- Coin transactions are logged in `coin_transactions`.
- Coin grants use an idempotency key so the same XP event does not create duplicate coins.

Existing students get an initial wallet based on their current `students.total_xp` when you run the SQL setup file.

## Avatar Assets

The first version includes placeholder SVG art from code, matched by item slug. You can replace it with real assets later.

Recommended Supabase Storage setup:

1. Create a public bucket named `avatar-assets`.
2. Upload approved transparent SVG or PNG files.
3. Copy the public URL.
4. Open `/admin/avatar`.
5. Paste the URL into `Asset URL or SVG Data URL`.
6. Save the avatar item.

Suggested file limits:

- SVG or PNG only.
- Keep files under 500 KB when possible.
- Use transparent backgrounds for item layers.
- Keep item art centered in a square canvas.

## Adding New Avatar Items

Use `/admin/avatar`.

Required fields:

- Name
- Category
- Rarity
- Price
- Layer order
- Unlock type

Unlock types:

- `purchase`: students can buy it with Academy Coins.
- `achievement`: hidden behind a quest/badge/achievement reward.
- `admin_grant`: teacher grants it manually.
- `default`: starter item every student should own.

## Granting Achievement Items

The reusable server helper is:

`grantAvatarItem(studentId, itemId, sourceType)`

Current integration points:

- Teacher can grant any item from `/admin/avatar`.
- Future quest/badge completion code can call `grantAvatarItem(...)` after a matching achievement is completed.

Example reward ideas already represented in item data:

- Win 5 rapid games in one day: `Rapid Racer Goggles`
- Solve 50 puzzles in one week: `Puzzle Wizard Hat`
- High-tier badge: `Golden Grandmaster Aura`

## Security Notes

- Purchases happen server-side only.
- The client never sends or controls the item price.
- Students cannot equip unowned items.
- Students cannot grant themselves items.
- `SUPABASE_SERVICE_ROLE_KEY` is used only in server code.
- `SUPABASE_SERVICE_ROLE_KEY` must never be exposed with `NEXT_PUBLIC_`.

## Current Limitations

- Asset upload UI is not built yet. Use Supabase Storage manually, then paste the asset URL in `/admin/avatar`.
- The project has no automated test runner configured. Type-check and production build are used for verification.
- Public/student cards still use their existing display style unless you replace them with the new reusable `AvatarRenderer`.
