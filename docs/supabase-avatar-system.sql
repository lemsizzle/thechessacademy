-- Chess Academy Quest Board avatar creator, cosmetic store, and Academy Coins.
-- Safe to run in Supabase SQL Editor after the original app schema.
-- This file does not drop or truncate existing data.

create extension if not exists pgcrypto;

-- Shared updated_at helper.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Cosmetic item catalog.
create table if not exists public.avatar_items (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text default '',
  category text not null,
  rarity text not null default 'Common',
  price integer not null default 0,
  asset_url text,
  thumbnail_url text,
  layer_order integer not null default 0,
  unlock_type text not null default 'purchase',
  unlock_requirement text,
  is_active boolean not null default true,
  is_featured boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'avatar_items_category_valid') then
    alter table public.avatar_items
      add constraint avatar_items_category_valid check (category in (
        'base_face', 'skin_tone', 'eyes', 'eyebrows', 'mouth', 'hair', 'facial_hair',
        'clothing', 'headwear', 'glasses', 'chess_accessory', 'background', 'aura_effect'
      ));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'avatar_items_rarity_valid') then
    alter table public.avatar_items
      add constraint avatar_items_rarity_valid check (rarity in ('Common', 'Uncommon', 'Rare', 'Epic', 'Legendary'));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'avatar_items_unlock_type_valid') then
    alter table public.avatar_items
      add constraint avatar_items_unlock_type_valid check (unlock_type in ('purchase', 'achievement', 'admin_grant', 'default'));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'avatar_items_price_nonnegative') then
    alter table public.avatar_items
      add constraint avatar_items_price_nonnegative check (price >= 0);
  end if;
end $$;

-- Student-owned item inventory.
create table if not exists public.student_inventory (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  item_id uuid not null references public.avatar_items(id) on delete cascade,
  acquisition_type text not null default 'admin_grant',
  acquired_at timestamptz not null default now(),
  unique(student_id, item_id)
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'student_inventory_acquisition_type_valid') then
    alter table public.student_inventory
      add constraint student_inventory_acquisition_type_valid check (acquisition_type in ('default', 'purchase', 'achievement', 'admin_grant'));
  end if;
end $$;

-- Equipped avatar layers are stored as a category -> avatar_items.id JSON object.
create table if not exists public.student_avatar (
  student_id uuid primary key references public.students(id) on delete cascade,
  equipped_items jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- Spendable wallet. Lifetime XP remains on students.total_xp and is never reduced by purchases.
create table if not exists public.student_wallets (
  student_id uuid primary key references public.students(id) on delete cascade,
  academy_coins integer not null default 0,
  total_coins_earned integer not null default 0,
  total_coins_spent integer not null default 0,
  updated_at timestamptz not null default now(),
  constraint student_wallets_balances_nonnegative check (
    academy_coins >= 0 and total_coins_earned >= 0 and total_coins_spent >= 0
  )
);

-- Coin audit log. idempotency_key prevents duplicate XP/coin rewards.
create table if not exists public.coin_transactions (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  amount integer not null,
  transaction_type text not null,
  source_type text not null,
  source_id text,
  description text not null default '',
  idempotency_key text,
  created_at timestamptz not null default now()
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'coin_transactions_type_valid') then
    alter table public.coin_transactions
      add constraint coin_transactions_type_valid check (transaction_type in ('earn', 'spend', 'adjustment', 'refund'));
  end if;
end $$;

create table if not exists public.store_purchases (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  item_id uuid not null references public.avatar_items(id) on delete restrict,
  price_paid integer not null default 0,
  created_at timestamptz not null default now(),
  unique(student_id, item_id)
);

-- Indexes for common app queries.
create index if not exists avatar_items_active_category_idx on public.avatar_items(is_active, category, rarity);
create index if not exists avatar_items_featured_idx on public.avatar_items(is_featured) where is_featured = true;
create index if not exists student_inventory_student_id_idx on public.student_inventory(student_id);
create index if not exists student_inventory_item_id_idx on public.student_inventory(item_id);
create index if not exists coin_transactions_student_created_idx on public.coin_transactions(student_id, created_at desc);
create unique index if not exists coin_transactions_idempotency_key_idx
  on public.coin_transactions(idempotency_key)
  where idempotency_key is not null;
create index if not exists store_purchases_student_created_idx on public.store_purchases(student_id, created_at desc);

drop trigger if exists set_avatar_items_updated_at on public.avatar_items;
create trigger set_avatar_items_updated_at
before update on public.avatar_items
for each row execute function public.set_updated_at();

drop trigger if exists set_student_avatar_updated_at on public.student_avatar;
create trigger set_student_avatar_updated_at
before update on public.student_avatar
for each row execute function public.set_updated_at();

drop trigger if exists set_student_wallets_updated_at on public.student_wallets;
create trigger set_student_wallets_updated_at
before update on public.student_wallets
for each row execute function public.set_updated_at();

-- Starter catalog. The app supplies matching placeholder SVGs by slug if these URLs are blank.
insert into public.avatar_items
  (name, slug, description, category, rarity, price, layer_order, unlock_type, unlock_requirement, is_active, is_featured)
values
  ('Starlit Board', 'starlit-board', 'A simple chessboard classroom backdrop.', 'background', 'Common', 0, 0, 'default', 'Starter avatar item.', true, false),
  ('Academy Face', 'academy-face', 'A friendly cartoon student face.', 'base_face', 'Common', 0, 10, 'default', 'Starter avatar item.', true, false),
  ('Warm Skin Tone', 'warm-skin-tone', 'A warm starter skin tone layer.', 'skin_tone', 'Common', 0, 12, 'default', 'Starter avatar item.', true, false),
  ('Bright Quest Eyes', 'bright-quest-eyes', 'Focused eyes ready for tactics.', 'eyes', 'Common', 0, 20, 'default', 'Starter avatar item.', true, false),
  ('Steady Brows', 'steady-brows', 'Calm calculation eyebrows.', 'eyebrows', 'Common', 0, 22, 'default', 'Starter avatar item.', true, false),
  ('Brave Smile', 'brave-smile', 'A confident academy smile.', 'mouth', 'Common', 0, 24, 'default', 'Starter avatar item.', true, false),
  ('Rookie Hair', 'rookie-hair', 'Starter hairstyle for new questers.', 'hair', 'Common', 0, 30, 'default', 'Starter avatar item.', true, false),
  ('Academy Shirt', 'academy-shirt', 'The classic Chess Academy shirt.', 'clothing', 'Common', 0, 40, 'default', 'Starter avatar item.', true, false),
  ('Pawn Cap', 'pawn-cap', 'A clean cap for brave first moves.', 'headwear', 'Common', 5, 50, 'purchase', null, true, true),
  ('Chessboard T-Shirt', 'chessboard-t-shirt', 'A casual shirt with board-square energy.', 'clothing', 'Common', 10, 40, 'purchase', null, true, false),
  ('Bishop Glasses', 'bishop-glasses', 'Diagonal vision with scholarly shine.', 'glasses', 'Common', 12, 55, 'purchase', null, true, false),
  ('Knight Headphones', 'knight-headphones', 'Headphones shaped for tactical focus.', 'headwear', 'Uncommon', 20, 50, 'purchase', null, true, true),
  ('Rook Backpack', 'rook-backpack', 'Carry your prep like a fortress.', 'chess_accessory', 'Uncommon', 25, 60, 'purchase', null, true, false),
  ('Rapid Racer Goggles', 'rapid-racer-goggles', 'Speedy goggles for rapid-game quests.', 'glasses', 'Uncommon', 35, 55, 'purchase', null, true, true),
  ('Puzzle Wizard Hat', 'puzzle-wizard-hat', 'A wizard hat for puzzle streaks.', 'headwear', 'Rare', 40, 50, 'purchase', null, true, true),
  ('Knight Helmet', 'knight-helmet', 'A bold helmet for brave attackers.', 'headwear', 'Rare', 50, 50, 'purchase', null, true, false),
  ('Queen''s Cape', 'queens-cape', 'A royal cape with attacking flair.', 'clothing', 'Rare', 65, 41, 'purchase', null, true, false),
  ('Mini Rook Companion', 'mini-rook-companion', 'A tiny rook buddy for your shoulder.', 'chess_accessory', 'Epic', 70, 60, 'purchase', null, true, false),
  ('Checkmate Crown', 'checkmate-crown', 'A crown for finishing attacks.', 'headwear', 'Epic', 90, 50, 'purchase', null, true, true),
  ('Grandmaster Suit', 'grandmaster-suit', 'Formal gear for tournament day.', 'clothing', 'Epic', 100, 40, 'purchase', null, true, false),
  ('Glowing Chess Eyes', 'glowing-chess-eyes', 'Eyes that glow when tactics appear.', 'eyes', 'Epic', 110, 20, 'purchase', null, true, false),
  ('Dark King Armor', 'dark-king-armor', 'Boss-level armor with kingly pressure.', 'clothing', 'Legendary', 135, 40, 'purchase', null, true, false),
  ('Golden Grandmaster Aura', 'golden-grandmaster-aura', 'A radiant aura for legendary progress.', 'aura_effect', 'Legendary', 150, 5, 'purchase', null, true, true)
on conflict (slug) do update set
  name = excluded.name,
  description = excluded.description,
  category = excluded.category,
  rarity = excluded.rarity,
  price = excluded.price,
  layer_order = excluded.layer_order,
  unlock_type = excluded.unlock_type,
  unlock_requirement = excluded.unlock_requirement,
  is_active = excluded.is_active,
  is_featured = excluded.is_featured,
  updated_at = now();

-- Existing students receive an idempotent initial coin balance based on lifetime XP.
-- 1 lifetime XP = 1 Academy Coin. Purchases never deduct lifetime XP.
insert into public.student_wallets (student_id, academy_coins, total_coins_earned, total_coins_spent)
select id, 0, 0, 0
from public.students
on conflict (student_id) do nothing;

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

-- Existing students receive default avatar items once.
insert into public.student_inventory (student_id, item_id, acquisition_type)
select students.id, avatar_items.id, 'default'
from public.students
cross join public.avatar_items
where avatar_items.slug in (
  'starlit-board', 'academy-face', 'warm-skin-tone', 'bright-quest-eyes',
  'steady-brows', 'brave-smile', 'rookie-hair', 'academy-shirt'
)
on conflict (student_id, item_id) do nothing;

insert into public.student_avatar (student_id, equipped_items)
select
  students.id,
  jsonb_object_agg(avatar_items.category, avatar_items.id::text)
from public.students
join public.avatar_items on avatar_items.slug in (
  'starlit-board', 'academy-face', 'warm-skin-tone', 'bright-quest-eyes',
  'steady-brows', 'brave-smile', 'rookie-hair', 'academy-shirt'
)
group by students.id
on conflict (student_id) do nothing;

-- Atomic coin grants/adjustments. Locked down to service_role only.
create or replace function public.grant_academy_coins(
  p_student_id uuid,
  p_amount integer,
  p_transaction_type text,
  p_source_type text,
  p_source_id text,
  p_description text,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_wallet public.student_wallets%rowtype;
  v_existing public.coin_transactions%rowtype;
  v_next_balance integer;
  v_transaction public.coin_transactions%rowtype;
begin
  if p_idempotency_key is not null then
    select * into v_existing from public.coin_transactions where idempotency_key = p_idempotency_key;
    if found then
      return jsonb_build_object('ok', true, 'alreadyRecorded', true, 'transactionId', v_existing.id);
    end if;
  end if;

  insert into public.student_wallets (student_id, academy_coins, total_coins_earned, total_coins_spent)
  values (p_student_id, 0, 0, 0)
  on conflict (student_id) do nothing;

  select * into v_wallet
  from public.student_wallets
  where student_id = p_student_id
  for update;

  v_next_balance := v_wallet.academy_coins + p_amount;
  if v_next_balance < 0 then
    raise exception 'Not enough Academy Coins.';
  end if;

  update public.student_wallets
  set
    academy_coins = v_next_balance,
    total_coins_earned = total_coins_earned + case when p_amount > 0 then p_amount else 0 end,
    total_coins_spent = total_coins_spent + case when p_amount < 0 then abs(p_amount) else 0 end
  where student_id = p_student_id;

  insert into public.coin_transactions
    (student_id, amount, transaction_type, source_type, source_id, description, idempotency_key)
  values
    (p_student_id, p_amount, p_transaction_type, p_source_type, p_source_id, p_description, p_idempotency_key)
  returning * into v_transaction;

  return jsonb_build_object('ok', true, 'alreadyRecorded', false, 'transactionId', v_transaction.id);
end;
$$;

create or replace function public.purchase_avatar_item(p_student_id uuid, p_item_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item public.avatar_items%rowtype;
  v_wallet public.student_wallets%rowtype;
  v_key text := 'purchase:' || p_student_id::text || ':' || p_item_id::text;
begin
  select * into v_item
  from public.avatar_items
  where id = p_item_id
  for update;

  if not found or v_item.is_active is not true then
    raise exception 'This item is not available right now.';
  end if;

  if v_item.unlock_type <> 'purchase' then
    raise exception 'This item is unlocked through achievements or by your teacher.';
  end if;

  if exists (select 1 from public.student_inventory where student_id = p_student_id and item_id = p_item_id) then
    raise exception 'Item already owned.';
  end if;

  insert into public.student_wallets (student_id, academy_coins, total_coins_earned, total_coins_spent)
  values (p_student_id, 0, 0, 0)
  on conflict (student_id) do nothing;

  select * into v_wallet
  from public.student_wallets
  where student_id = p_student_id
  for update;

  if v_wallet.academy_coins < v_item.price then
    raise exception 'Not enough Academy Coins.';
  end if;

  update public.student_wallets
  set academy_coins = academy_coins - v_item.price,
      total_coins_spent = total_coins_spent + v_item.price
  where student_id = p_student_id;

  insert into public.student_inventory (student_id, item_id, acquisition_type)
  values (p_student_id, p_item_id, 'purchase');

  insert into public.coin_transactions
    (student_id, amount, transaction_type, source_type, source_id, description, idempotency_key)
  values
    (p_student_id, -v_item.price, 'spend', 'avatar_purchase', p_item_id::text, 'Purchased avatar item: ' || v_item.name, v_key);

  insert into public.store_purchases (student_id, item_id, price_paid)
  values (p_student_id, p_item_id, v_item.price);

  return jsonb_build_object('ok', true, 'itemId', p_item_id, 'pricePaid', v_item.price);
end;
$$;

revoke all on function public.grant_academy_coins(uuid, integer, text, text, text, text, text) from public, anon, authenticated;
revoke all on function public.purchase_avatar_item(uuid, uuid) from public, anon, authenticated;
grant execute on function public.grant_academy_coins(uuid, integer, text, text, text, text, text) to service_role;
grant execute on function public.purchase_avatar_item(uuid, uuid) to service_role;

-- RLS. The app reads/writes private student wallet and inventory data through server routes.
alter table public.avatar_items enable row level security;
alter table public.student_inventory enable row level security;
alter table public.student_avatar enable row level security;
alter table public.student_wallets enable row level security;
alter table public.coin_transactions enable row level security;
alter table public.store_purchases enable row level security;

drop policy if exists "Public can read active avatar items" on public.avatar_items;
create policy "Public can read active avatar items"
on public.avatar_items
for select
to anon, authenticated
using (is_active = true);

drop policy if exists "Service role manages avatar items" on public.avatar_items;
create policy "Service role manages avatar items"
on public.avatar_items
for all
to service_role
using (true)
with check (true);

drop policy if exists "Service role manages student inventory" on public.student_inventory;
create policy "Service role manages student inventory"
on public.student_inventory
for all
to service_role
using (true)
with check (true);

drop policy if exists "Service role manages student avatars" on public.student_avatar;
create policy "Service role manages student avatars"
on public.student_avatar
for all
to service_role
using (true)
with check (true);

drop policy if exists "Service role manages student wallets" on public.student_wallets;
create policy "Service role manages student wallets"
on public.student_wallets
for all
to service_role
using (true)
with check (true);

drop policy if exists "Service role manages coin transactions" on public.coin_transactions;
create policy "Service role manages coin transactions"
on public.coin_transactions
for all
to service_role
using (true)
with check (true);

drop policy if exists "Service role manages store purchases" on public.store_purchases;
create policy "Service role manages store purchases"
on public.store_purchases
for all
to service_role
using (true)
with check (true);

grant select on public.avatar_items to anon, authenticated;
grant all on public.avatar_items to service_role;
grant all on public.student_inventory to service_role;
grant all on public.student_avatar to service_role;
grant all on public.student_wallets to service_role;
grant all on public.coin_transactions to service_role;
grant all on public.store_purchases to service_role;
