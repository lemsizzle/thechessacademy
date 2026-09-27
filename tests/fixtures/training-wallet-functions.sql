-- Existing production coin functions captured for isolated reward regression tests.
CREATE OR REPLACE FUNCTION public.award_academy_coins_for_xp_event()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if new.amount > 0 then
    perform public.grant_academy_coins(
      new.student_id, new.amount, 'earn', 'xp_event', new.id::text,
      new.reason, 'xp_event:' || new.id::text
    );
  end if;
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.grant_academy_coins(p_student_id uuid, p_amount integer, p_transaction_type text, p_source_type text, p_source_id text, p_description text, p_idempotency_key text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_wallet public.student_wallets%rowtype; v_existing public.coin_transactions%rowtype; v_next_balance integer; v_transaction public.coin_transactions%rowtype;
begin
  if p_idempotency_key is not null then
    select * into v_existing from public.coin_transactions where idempotency_key = p_idempotency_key;
    if found then return jsonb_build_object('ok', true, 'alreadyRecorded', true, 'transactionId', v_existing.id); end if;
  end if;
  insert into public.student_wallets (student_id, academy_coins, total_coins_earned, total_coins_spent) values (p_student_id, 0, 0, 0) on conflict (student_id) do nothing;
  select * into v_wallet from public.student_wallets where student_id = p_student_id for update;
  v_next_balance := v_wallet.academy_coins + p_amount;
  if v_next_balance < 0 then raise exception 'Not enough Academy Coins.'; end if;
  update public.student_wallets set academy_coins = v_next_balance, total_coins_earned = total_coins_earned + case when p_amount > 0 then p_amount else 0 end, total_coins_spent = total_coins_spent + case when p_amount < 0 then abs(p_amount) else 0 end where student_id = p_student_id;
  insert into public.coin_transactions (student_id, amount, transaction_type, source_type, source_id, description, idempotency_key) values (p_student_id, p_amount, p_transaction_type, p_source_type, p_source_id, p_description, p_idempotency_key) returning * into v_transaction;
  return jsonb_build_object('ok', true, 'alreadyRecorded', false, 'transactionId', v_transaction.id);
end;
$function$;

