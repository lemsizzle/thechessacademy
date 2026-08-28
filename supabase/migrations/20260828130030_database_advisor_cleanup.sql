-- Address high-confidence Supabase database advisor findings without changing
-- application data or public access semantics.

create index if not exists quests_badge_reward_id_idx
  on public.quests (badge_reward_id);

create index if not exists store_purchases_item_id_idx
  on public.store_purchases (item_id);

alter function public.set_updated_at()
  set search_path = pg_catalog, public;

-- These two deny-all policies overlap for SELECT. A single ALL policy retains
-- the same deny-by-default behavior without duplicate policy evaluation.
drop policy if exists "No public reads for lichess sync state"
  on public.lichess_sync_state;

drop policy if exists "No public writes for lichess sync state"
  on public.lichess_sync_state;

create policy "No public access for lichess sync state"
  on public.lichess_sync_state
  for all
  to anon, authenticated
  using (false)
  with check (false);
