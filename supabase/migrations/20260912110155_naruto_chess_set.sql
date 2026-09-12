-- Apply after the matching application deployment is ready.
insert into public.avatar_items (
 id,name,slug,description,category,rarity,price,asset_url,thumbnail_url,
 layer_order,unlock_type,unlock_requirement,is_active,is_featured
) values (
 '98be0000-0000-4000-8000-000000000004','Naruto Chess Set','naruto-chess-set',
 'A Mythic shinobi showdown: Hidden Leaf ivory and gold against Akatsuki obsidian and crimson. Fox knights, kunai bishops and Hokage kings command a gold-sealed chakra board. Includes the board and all matching pieces.',
 'board_theme','Mythic',1000,'/chess/themes/naruto-preview.svg','/chess/themes/naruto-preview.svg',
 0,'purchase',null,true,true
) on conflict(slug) do nothing;
