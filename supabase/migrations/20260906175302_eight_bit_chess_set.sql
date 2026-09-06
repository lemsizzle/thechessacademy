-- Apply with the matching app release so every purchaser can use the new theme.
-- Reuses existing server-authoritative purchases; no wallet, inventory or RLS changes.
insert into public.avatar_items (
  id, name, slug, description, category, rarity, price, asset_url, thumbnail_url,
  layer_order, unlock_type, unlock_requirement, is_active, is_featured
) values (
  '98be0000-0000-4000-8000-000000000003', '8-Bit Chess Set', 'eight-bit-chess-set',
  'Level up your next move! A retro mint-and-indigo pixel board with golden-cream and violet 8-bit pieces. Unlock the board and every matching piece, then mix and match using the gear beside your board.',
  'board_theme', 'Epic', 800, '/chess/themes/eight-bit-preview.svg', '/chess/themes/eight-bit-preview.svg',
  0, 'purchase', null, true, true
) on conflict (slug) do nothing;
