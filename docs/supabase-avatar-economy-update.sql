-- Avatar economy update for The Chess Academy Quest Board.
-- Safe to run after docs/supabase-avatar-system.sql.
-- This does not drop tables, delete students, or reduce lifetime XP.

-- 1. Update item prices to match the current class XP scale.
update public.avatar_items
set price = price_updates.price,
    rarity = price_updates.rarity,
    unlock_type = 'purchase',
    unlock_requirement = null,
    updated_at = now()
from (
  values
    ('pawn-cap', 5, 'Common'),
    ('chessboard-t-shirt', 10, 'Common'),
    ('bishop-glasses', 12, 'Common'),
    ('knight-headphones', 20, 'Uncommon'),
    ('rook-backpack', 25, 'Uncommon'),
    ('rapid-racer-goggles', 35, 'Uncommon'),
    ('puzzle-wizard-hat', 40, 'Rare'),
    ('knight-helmet', 50, 'Rare'),
    ('queens-cape', 65, 'Rare'),
    ('mini-rook-companion', 70, 'Epic'),
    ('checkmate-crown', 90, 'Epic'),
    ('grandmaster-suit', 100, 'Epic'),
    ('glowing-chess-eyes', 110, 'Epic'),
    ('dark-king-armor', 135, 'Legendary'),
    ('golden-grandmaster-aura', 150, 'Legendary')
) as price_updates(slug, price, rarity)
where avatar_items.slug = price_updates.slug;

-- 2. Achievement-only/admin-grant/default items should never have a purchasable price.
update public.avatar_items
set price = 0,
    updated_at = now()
where unlock_type <> 'purchase'
  and price <> 0;

-- 3. Ensure every student has a wallet. Start with zero, then apply an idempotent XP backfill below.
insert into public.student_wallets (student_id, academy_coins, total_coins_earned, total_coins_spent)
select id, 0, 0, 0
from public.students
on conflict (student_id) do nothing;

-- 4. Idempotent one-time backfill:
-- If a student's total coins earned is below lifetime XP, grant only the missing difference.
-- Running this again will not repeatedly grant coins.
with coin_deltas as (
  select
    students.id as student_id,
    greatest(coalesce(students.total_xp, 0), 0) - coalesce(student_wallets.total_coins_earned, 0) as amount
  from public.students
  join public.student_wallets on student_wallets.student_id = students.id
),
inserted_transactions as (
  insert into public.coin_transactions
    (student_id, amount, transaction_type, source_type, source_id, description, idempotency_key)
  select
    student_id,
    amount,
    'earn',
    'xp_initial_backfill',
    student_id::text,
    'Initial Academy Coins from lifetime XP.',
    'xp-initial-backfill-v2:' || student_id::text
  from coin_deltas
  where amount > 0
  on conflict (idempotency_key) do nothing
  returning student_id, amount
)
update public.student_wallets
set
  academy_coins = academy_coins + inserted_transactions.amount,
  total_coins_earned = total_coins_earned + inserted_transactions.amount
from inserted_transactions
where student_wallets.student_id = inserted_transactions.student_id;

-- 5. Optional sanity check after running:
-- select display_name, total_xp, academy_coins, total_coins_earned, total_coins_spent
-- from public.students
-- join public.student_wallets on student_wallets.student_id = students.id
-- order by total_xp desc;
