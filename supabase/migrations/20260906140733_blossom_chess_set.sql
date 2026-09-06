-- Reuse the existing server-authoritative purchase, wallet and inventory transaction.
-- Paper's migration already permits board_theme; no new grants, tables or equipment.
insert into public.avatar_items (
  id, name, slug, description, category, rarity, price, asset_url, thumbnail_url,
  layer_order, unlock_type, unlock_requirement, is_active, is_featured
) values (
  '98be0000-0000-4000-8000-000000000002', 'Blossom Chess Set', 'blossom-chess-set',
  'Make your next move bloom! A rose-and-lilac board with pearl and plum pieces, sweet bows, and sparkling crown jewels. Unlock the board and every matching piece, then mix and match using the gear beside your board.',
  'board_theme', 'Rare', 400, '/chess/themes/blossom-preview.svg', '/chess/themes/blossom-preview.svg',
  0, 'purchase', null, true, true
) on conflict (slug) do nothing;
