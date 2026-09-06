-- Board/piece cosmetics reuse the existing atomic coin purchase and inventory flow.
-- No new tables, functions, browser grants, or changes to avatar equipment are needed.
alter table public.avatar_items drop constraint if exists avatar_items_category_check;
alter table public.avatar_items drop constraint if exists avatar_items_category_valid;
alter table public.avatar_items add constraint avatar_items_category_check check (category in (
  'base_face', 'skin_tone', 'eyes', 'eyebrows', 'mouth', 'hair', 'facial_hair',
  'clothing', 'headwear', 'glasses', 'chess_accessory', 'background', 'aura_effect', 'board_theme'
));

insert into public.avatar_items (
  id, name, slug, description, category, rarity, price, asset_url, thumbnail_url,
  layer_order, unlock_type, unlock_requirement, is_active, is_featured
) values (
  '98be0000-0000-4000-8000-000000000001', 'Paper Chess Set', 'paper-chess-set',
  'A warm, textured paper board and a complete set of cream and charcoal paper-cut pieces. Unlock both, then mix and match using the gear beside your board.',
  'board_theme', 'Rare', 800, '/chess/themes/paper-preview.svg', '/chess/themes/paper-preview.svg',
  0, 'purchase', null, true, true
) on conflict (slug) do nothing;
