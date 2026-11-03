create table public.store_reward_receipts (
  id uuid primary key,
  student_id uuid not null references public.students(id) on delete cascade,
  kind text not null check (kind in ('mystery_box','free_class')),
  price_paid integer not null check (price_paid in (500,5000)),
  item_id uuid references public.avatar_items(id) on delete restrict,
  item_snapshot jsonb,
  status text not null check (status in ('awarded','pending','fulfilled','refunded')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  check ((kind='mystery_box' and price_paid=500 and item_id is not null and status='awarded') or
         (kind='free_class' and price_paid=5000 and item_id is null and status in ('pending','fulfilled','refunded')))
);
create index store_reward_receipts_student_idx on public.store_reward_receipts(student_id,created_at desc);
create index store_reward_receipts_pending_idx on public.store_reward_receipts(created_at) where status='pending';
create index store_reward_receipts_item_idx on public.store_reward_receipts(item_id) where item_id is not null;
alter table public.store_reward_receipts enable row level security;
revoke all on public.store_reward_receipts from public,anon,authenticated;
grant select,insert,update on public.store_reward_receipts to service_role;

create function public.purchase_store_reward(p_student_id uuid,p_kind text,p_request_id uuid)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare receipt public.store_reward_receipts; item public.avatar_items; balance integer;
  cost integer; granted uuid; tries integer:=0;
begin
  if p_kind is null or p_kind not in ('mystery_box','free_class') or p_request_id is null then
    raise exception 'Choose a store reward.';
  end if;
  if not exists(select 1 from public.students where id=p_student_id and is_active) then
    raise exception 'Student login is no longer active.';
  end if;
  -- The same lock as ordinary item purchases prevents concurrent overspending.
  select academy_coins into balance from public.student_wallets where student_id=p_student_id for update;
  if not found then raise exception 'Open the Avatar Store before purchasing.'; end if;
  select * into receipt from public.store_reward_receipts where id=p_request_id;
  if found then
    if receipt.student_id<>p_student_id or receipt.kind<>p_kind then raise exception 'Purchase reference is already in use.'; end if;
    return to_jsonb(receipt);
  end if;
  cost:=case when p_kind='mystery_box' then 500 else 5000 end;
  if balance<cost then raise exception 'Not enough Academy Coins.'; end if;
  if p_kind='mystery_box' then
    loop
      -- Exponential race: each eligible item's weight is exactly 1 / price.
      -- The roll stays server-side and is committed with payment and ownership.
      select a.* into item from public.avatar_items a where a.is_active and a.unlock_type='purchase'
        and a.price>0 and a.category<>'board_theme'
        and not exists(select 1 from public.student_inventory i where i.student_id=p_student_id and i.item_id=a.id)
        order by -ln(greatest(1.0-random(),1e-15))*a.price limit 1;
      if not found then raise exception 'You already own every available mystery-box item. No coins were spent.'; end if;
      insert into public.student_inventory(student_id,item_id,acquisition_type)
        values(p_student_id,item.id,'purchase') on conflict(student_id,item_id) do nothing returning item_id into granted;
      exit when granted is not null;
      tries:=tries+1;
      if tries>=5 then raise exception 'Your collection changed. Please retry; no coins were spent.'; end if;
    end loop;
    insert into public.store_purchases(student_id,item_id,price_paid) values(p_student_id,item.id,cost)
      on conflict(student_id,item_id) do nothing;
  end if;
  update public.student_wallets set academy_coins=academy_coins-cost,total_coins_spent=total_coins_spent+cost,
    updated_at=now() where student_id=p_student_id;
  insert into public.coin_transactions(student_id,amount,transaction_type,source_type,source_id,description,idempotency_key)
    values(p_student_id,-cost,'spend','store_reward',p_request_id::text,
      case when p_kind='mystery_box' then 'Mystery Box: '||item.name else 'Free Class redemption' end,
      'store-reward:'||p_request_id::text);
  insert into public.store_reward_receipts(id,student_id,kind,price_paid,item_id,item_snapshot,status)
    values(p_request_id,p_student_id,p_kind,cost,item.id,
      case when p_kind='mystery_box' then to_jsonb(item) else null end,
      case when p_kind='mystery_box' then 'awarded' else 'pending' end) returning * into receipt;
  return to_jsonb(receipt);
end $$;
revoke all on function public.purchase_store_reward(uuid,text,uuid) from public,anon,authenticated;
grant execute on function public.purchase_store_reward(uuid,text,uuid) to service_role;

create function public.resolve_free_class_reward(p_receipt_id uuid,p_resolution text)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare receipt public.store_reward_receipts;
begin
  if p_resolution is null or p_resolution not in ('fulfilled','refunded') then raise exception 'Choose fulfilled or refunded.'; end if;
  select * into receipt from public.store_reward_receipts where id=p_receipt_id and kind='free_class' for update;
  if not found then raise exception 'Class reward not found.'; end if;
  if receipt.status=p_resolution then return to_jsonb(receipt); end if;
  if receipt.status<>'pending' then raise exception 'This class reward has already been resolved.'; end if;
  if p_resolution='refunded' then
    update public.student_wallets set academy_coins=academy_coins+receipt.price_paid,
      total_coins_spent=greatest(0,total_coins_spent-receipt.price_paid),updated_at=now() where student_id=receipt.student_id;
    if not found then raise exception 'Student wallet not found.'; end if;
    insert into public.coin_transactions(student_id,amount,transaction_type,source_type,source_id,description,idempotency_key)
      values(receipt.student_id,receipt.price_paid,'refund','store_reward',receipt.id::text,'Free Class refund','store-reward-refund:'||receipt.id::text);
  end if;
  update public.store_reward_receipts set status=p_resolution,resolved_at=now() where id=receipt.id returning * into receipt;
  return to_jsonb(receipt);
end $$;
revoke all on function public.resolve_free_class_reward(uuid,text) from public,anon,authenticated;
grant execute on function public.resolve_free_class_reward(uuid,text) to service_role;
