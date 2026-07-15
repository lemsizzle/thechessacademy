-- Simplify the starter avatar, add inclusive skin tones and long hair,
-- and lock former nonessential starter add-ons behind store purchases.
-- This data migration is idempotent and preserves teacher-edited prices
-- after an item has already been converted to a purchase item.

insert into public.avatar_items
  (name, slug, description, category, rarity, price, layer_order, unlock_type, unlock_requirement, is_active, is_featured)
values
  ('Light Skin Tone', 'light-skin-tone', 'A light skin tone, always free to use.', 'skin_tone', 'Common', 0, 12, 'default', 'Free core avatar choice.', true, false),
  ('Deep Skin Tone', 'deep-skin-tone', 'A deep skin tone, always free to use.', 'skin_tone', 'Common', 0, 12, 'default', 'Free core avatar choice.', true, false),
  ('Long Flowing Hair', 'long-flowing-hair', 'A long hairstyle that frames the face and falls over the shoulders.', 'hair', 'Common', 10, 30, 'purchase', null, true, true)
on conflict (slug) do nothing;

-- Only convert untouched former defaults. Once a teacher changes the item,
-- rerunning this migration does not overwrite that decision.
update public.avatar_items
set price = 5,
    unlock_type = 'purchase',
    unlock_requirement = null,
    updated_at = now()
where slug = 'steady-brows'
  and unlock_type = 'default'
  and price = 0;

update public.avatar_items
set name = 'Rookie Hair',
    description = 'A neat short hairstyle for new questers.',
    price = 8,
    unlock_type = 'purchase',
    unlock_requirement = null,
    updated_at = now()
where slug = 'rookie-hair'
  and unlock_type = 'default'
  and price = 0;

-- Remove only the old automatic grants. Purchases, achievements, and teacher
-- grants are preserved.
delete from public.student_inventory as inventory
using public.avatar_items as item
where inventory.item_id = item.id
  and inventory.acquisition_type = 'default'
  and item.slug in ('steady-brows', 'rookie-hair');

-- Unequip those two former defaults without disturbing any other hairstyle
-- or eyebrow choice a student may have earned.
update public.student_avatar as avatar
set equipped_items = avatar.equipped_items - 'eyebrows',
    updated_at = now()
from public.avatar_items as item
where item.slug = 'steady-brows'
  and avatar.equipped_items ->> 'eyebrows' = item.id::text;

update public.student_avatar as avatar
set equipped_items = avatar.equipped_items - 'hair',
    updated_at = now()
from public.avatar_items as item
where item.slug = 'rookie-hair'
  and avatar.equipped_items ->> 'hair' = item.id::text;

-- Skin tone is a core identity choice, so all three tones remain free and
-- are automatically available to every existing student.
insert into public.student_inventory (student_id, item_id, acquisition_type)
select student.id, item.id, 'default'
from public.students as student
cross join public.avatar_items as item
where item.slug in ('light-skin-tone', 'warm-skin-tone', 'deep-skin-tone')
on conflict (student_id, item_id) do nothing;
