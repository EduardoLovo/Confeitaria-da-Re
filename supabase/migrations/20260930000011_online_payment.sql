-- =============================================================
-- Fase 2 — pagamento online (InfinitePay).
--
-- Regras:
--   • Entrega: pagamento online obrigatório.
--   • Retirada: online ou na retirada (Pix/cartão), a cliente escolhe.
--   • Pedido online nasce 'awaiting_payment' e tem 30 min para ser pago;
--     pago → 'received' (entra na fila da loja); vencido → 'cancelled'.
--   • Pagamento que chega depois do cancelamento fica registrado
--     (status 'cancelled' + payment_status 'paid') para a loja resolver.
--
-- Quem confirma o pagamento é SÓ o servidor (service_role), depois de
-- consultar a InfinitePay; nunca o navegador nem o aviso (webhook) sozinho.
-- =============================================================

-- -------------------------------------------------------------
-- Colunas do pagamento online
-- (payment_provider / payment_reference já existiam desde a 0001)
-- -------------------------------------------------------------
alter table public.orders
  add column payment_url text,
  add column payment_expires_at timestamptz,
  add column paid_at timestamptz,
  add column paid_amount_cents integer check (paid_amount_cents is null or paid_amount_cents >= 0),
  add column payment_capture_method text,
  add column payment_receipt_url text;

comment on column public.orders.payment_url is 'Link do checkout do gateway (só pagamento online).';
comment on column public.orders.payment_expires_at is 'Prazo para pagar; depois disso o pedido é cancelado por expire_unpaid_orders().';
comment on column public.orders.paid_amount_cents is 'Valor confirmado pelo gateway (pode ser maior que o total por juros de parcelamento).';
comment on column public.orders.payment_capture_method is 'Como a cliente pagou no gateway: pix, credit_card…';
comment on column public.orders.payment_reference is 'transaction_nsu da InfinitePay (id da transação paga).';

-- Pedido aguardando pagamento é sempre online e tem prazo.
alter table public.orders
  add constraint orders_awaiting_payment_is_online check (
    status <> 'awaiting_payment' or (payment_method = 'online' and payment_expires_at is not null)
  );

-- Usado pelo job de expiração.
create index orders_awaiting_payment_idx on public.orders (payment_expires_at)
  where status = 'awaiting_payment';

-- -------------------------------------------------------------
-- Fluxo de status (substitui a versão da 0002)
--   awaiting_payment → received (só se pago) | cancelled
--   Entrega:  received → confirmed → out_for_delivery → completed
--   Retirada: received → confirmed → ready_for_pickup → completed
--   cancelled a partir de qualquer etapa antes de completed
-- Nenhum pedido volta para awaiting_payment.
-- Espelhado em src/lib/domain/order-status.ts (para a UI).
-- -------------------------------------------------------------
create or replace function public.validate_order_status_transition()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  allowed boolean;
begin
  if new.status = old.status then
    return new;
  end if;

  allowed := case old.status
    -- O painel só tem permissão de mudar "status"; como payment_status não
    -- muda junto, ninguém do painel consegue "aprovar" um pedido não pago.
    when 'awaiting_payment' then
      new.status = 'cancelled'
      or (new.status = 'received' and new.payment_status = 'paid')
    when 'received' then new.status in ('confirmed', 'cancelled')
    when 'confirmed' then
      new.status = 'cancelled'
      or (old.fulfillment = 'delivery' and new.status = 'out_for_delivery')
      or (old.fulfillment = 'pickup' and new.status = 'ready_for_pickup')
    when 'out_for_delivery' then new.status in ('completed', 'cancelled')
    when 'ready_for_pickup' then new.status in ('completed', 'cancelled')
    else false
  end;

  if not allowed then
    raise exception 'INVALID_STATUS_TRANSITION'
      using detail = format('%s -> %s', old.status, new.status);
  end if;
  return new;
end;
$$;

-- -------------------------------------------------------------
-- create_order(payload): igual à da 0009, mais:
--   • entrega só com payment_method = 'online' (PAYMENT_METHOD_NOT_ALLOWED);
--   • online nasce 'awaiting_payment', provider 'infinitepay', prazo de 30 min.
--
-- payload:
-- {
--   customer_name, customer_phone, fulfillment, payment_method,
--   change_for_cents?, notes?, ip_hash?,
--   neighborhood?, cep?, street?, street_number?, complement?, address_reference?,
--   items: [{ product_id, quantity, note? }]
-- }
--
-- Retorno: { id, number, total_cents, requires_payment, payment_expires_at }
--
-- Erros (message): STORE_NOT_CONFIGURED, STORE_CLOSED, RATE_LIMITED,
--   INVALID_ITEMS, PRODUCT_UNAVAILABLE (detail = ids), BELOW_MINIMUM,
--   INVALID_ADDRESS, INVALID_CHANGE, PAYMENT_METHOD_NOT_ALLOWED
-- -------------------------------------------------------------
create or replace function public.create_order(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  c_payment_window constant interval := interval '30 minutes';
  v_settings public.store_settings%rowtype;
  v_fulfillment public.fulfillment_type := (payload ->> 'fulfillment')::public.fulfillment_type;
  v_payment public.payment_method := (payload ->> 'payment_method')::public.payment_method;
  v_online boolean;
  v_ip_hash text := nullif(payload ->> 'ip_hash', '');
  v_items jsonb := payload -> 'items';
  v_change integer := nullif(payload ->> 'change_for_cents', '')::integer;
  v_neighborhood text := nullif(btrim(payload ->> 'neighborhood'), '');
  v_fee integer := 0;
  v_subtotal integer;
  v_total integer;
  v_missing text;
  v_expires_at timestamptz;
  v_order_id uuid;
  v_number bigint;
begin
  select * into v_settings from public.store_settings where id;
  if not found then
    raise exception 'STORE_NOT_CONFIGURED';
  end if;

  if not public.is_store_open_now() then
    raise exception 'STORE_CLOSED';
  end if;

  -- Rate limit simples: no máximo 3 pedidos por IP a cada 10 minutos
  if v_ip_hash is not null and (
    select count(*) from public.orders
    where ip_hash = v_ip_hash and created_at > now() - interval '10 minutes'
  ) >= 3 then
    raise exception 'RATE_LIMITED';
  end if;

  -- Entrega exige pagamento online; retirada aceita os dois.
  v_online := v_payment = 'online';
  if v_fulfillment = 'delivery' and not v_online then
    raise exception 'PAYMENT_METHOD_NOT_ALLOWED';
  end if;

  if v_items is null
    or jsonb_typeof(v_items) <> 'array'
    or jsonb_array_length(v_items) not between 1 and 50
    or exists (
      select 1 from jsonb_array_elements(v_items) e(item)
      where (e.item ->> 'quantity') is null
        or (e.item ->> 'quantity')::integer not between 1 and 99
        or (e.item ->> 'product_id') is null
    )
  then
    raise exception 'INVALID_ITEMS';
  end if;

  -- Produto precisa existir, estar ativo, disponível e em categoria ativa
  select string_agg(distinct e.item ->> 'product_id', ',')
  into v_missing
  from jsonb_array_elements(v_items) e(item)
  where not exists (
    select 1
    from public.products p
    join public.categories c on c.id = p.category_id
    where p.id = (e.item ->> 'product_id')::uuid
      and p.is_active and p.is_available and c.is_active
  );
  if v_missing is not null then
    raise exception 'PRODUCT_UNAVAILABLE' using detail = v_missing;
  end if;

  select sum(p.price_cents * (e.item ->> 'quantity')::integer)
  into v_subtotal
  from jsonb_array_elements(v_items) e(item)
  join public.products p on p.id = (e.item ->> 'product_id')::uuid;

  if v_subtotal < v_settings.min_order_cents then
    raise exception 'BELOW_MINIMUM' using detail = v_settings.min_order_cents::text;
  end if;

  if v_fulfillment = 'delivery' then
    if v_neighborhood is null or length(v_neighborhood) not between 2 and 80 then
      raise exception 'INVALID_ADDRESS';
    end if;
    v_fee := v_settings.delivery_fee_cents;
  end if;

  v_total := v_subtotal + v_fee;

  if v_payment <> 'cash' then
    v_change := null;
  elsif v_change is not null and v_change < v_total then
    raise exception 'INVALID_CHANGE';
  end if;

  if v_online then
    v_expires_at := now() + c_payment_window;
  end if;

  insert into public.orders (
    customer_name, customer_phone, fulfillment,
    delivery_zone_id, zone_name_snapshot, cep, street, street_number, complement, address_reference,
    subtotal_cents, delivery_fee_cents, total_cents,
    payment_method, change_for_cents, notes, ip_hash,
    status, payment_provider, payment_expires_at
  ) values (
    btrim(payload ->> 'customer_name'),
    payload ->> 'customer_phone',
    v_fulfillment,
    null,
    case when v_fulfillment = 'delivery' then v_neighborhood end,
    case when v_fulfillment = 'delivery' then nullif(payload ->> 'cep', '') end,
    case when v_fulfillment = 'delivery' then nullif(btrim(payload ->> 'street'), '') end,
    case when v_fulfillment = 'delivery' then nullif(btrim(payload ->> 'street_number'), '') end,
    case when v_fulfillment = 'delivery' then nullif(btrim(payload ->> 'complement'), '') end,
    case when v_fulfillment = 'delivery' then nullif(btrim(payload ->> 'address_reference'), '') end,
    v_subtotal, v_fee, v_total,
    v_payment, v_change,
    nullif(btrim(payload ->> 'notes'), ''),
    v_ip_hash,
    case when v_online then 'awaiting_payment' else 'received' end::public.order_status,
    case when v_online then 'infinitepay' end,
    v_expires_at
  )
  returning id, number into v_order_id, v_number;

  insert into public.order_items (
    order_id, product_id, name_snapshot, unit_price_cents, quantity, line_total_cents, note, sort_order
  )
  select
    v_order_id,
    p.id,
    p.name,
    p.price_cents,
    (e.item ->> 'quantity')::integer,
    p.price_cents * (e.item ->> 'quantity')::integer,
    nullif(btrim(e.item ->> 'note'), ''),
    e.ord
  from jsonb_array_elements(v_items) with ordinality e(item, ord)
  join public.products p on p.id = (e.item ->> 'product_id')::uuid;

  return jsonb_build_object(
    'id', v_order_id,
    'number', v_number,
    'total_cents', v_total,
    'requires_payment', v_online,
    'payment_expires_at', v_expires_at
  );
end;
$$;

revoke execute on function public.create_order(jsonb) from public, anon, authenticated;
grant execute on function public.create_order(jsonb) to service_role;

-- -------------------------------------------------------------
-- confirm_order_payment(): registra o pagamento confirmado pelo gateway.
-- Chamada SOMENTE pelo servidor, depois de consultar a InfinitePay
-- (payment_check). Idempotente: o webhook e a volta do checkout podem
-- chamar para o mesmo pagamento sem efeito duplicado.
--
-- Retorno: { result, number }
--   result = 'confirmed'          → pagou agora; pedido entrou na fila (avise a loja)
--          | 'already_paid'       → já estava registrado; nada a fazer
--          | 'paid_after_cancel'  → pagou depois de cancelado; a loja decide (avise)
--
-- Erros: ORDER_NOT_FOUND, NOT_ONLINE_ORDER, AMOUNT_MISMATCH (detail = esperado/recebido)
-- -------------------------------------------------------------
create or replace function public.confirm_order_payment(
  p_order_id uuid,
  p_transaction_nsu text,
  p_paid_amount_cents integer,
  p_capture_method text default null,
  p_receipt_url text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders%rowtype;
begin
  -- Trava a linha: webhook e volta do checkout podem chegar juntos.
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'ORDER_NOT_FOUND';
  end if;

  if v_order.payment_method <> 'online' then
    raise exception 'NOT_ONLINE_ORDER';
  end if;

  if v_order.payment_status = 'paid' then
    return jsonb_build_object('result', 'already_paid', 'number', v_order.number);
  end if;

  -- Pode vir MAIOR (juros do parcelamento pagos pela cliente), nunca menor.
  if p_paid_amount_cents is null or p_paid_amount_cents < v_order.total_cents then
    raise exception 'AMOUNT_MISMATCH'
      using detail = format('%s/%s', v_order.total_cents, coalesce(p_paid_amount_cents::text, 'null'));
  end if;

  update public.orders
  set payment_status = 'paid',
      paid_at = now(),
      paid_amount_cents = p_paid_amount_cents,
      payment_reference = nullif(btrim(p_transaction_nsu), ''),
      payment_capture_method = nullif(btrim(p_capture_method), ''),
      payment_receipt_url = nullif(btrim(p_receipt_url), ''),
      status = case when status = 'awaiting_payment' then 'received'::public.order_status else status end
  where id = p_order_id;

  return jsonb_build_object(
    'result', case when v_order.status = 'cancelled' then 'paid_after_cancel' else 'confirmed' end,
    'number', v_order.number
  );
end;
$$;

revoke execute on function public.confirm_order_payment(uuid, text, integer, text, text) from public, anon, authenticated;
grant execute on function public.confirm_order_payment(uuid, text, integer, text, text) to service_role;

-- -------------------------------------------------------------
-- expire_unpaid_orders(): cancela pedidos online não pagos no prazo.
-- Roda pelo pg_cron a cada 5 minutos. Retorna quantos cancelou.
-- -------------------------------------------------------------
create or replace function public.expire_unpaid_orders()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  update public.orders
  set status = 'cancelled'
  where status = 'awaiting_payment'
    and payment_status <> 'paid'
    and payment_expires_at < now();
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke execute on function public.expire_unpaid_orders() from public, anon, authenticated;
grant execute on function public.expire_unpaid_orders() to service_role;

-- -------------------------------------------------------------
-- Agendamento (pg_cron, extensão nativa do Supabase).
-- cron.schedule com o mesmo nome atualiza o job existente.
-- -------------------------------------------------------------
create extension if not exists pg_cron with schema pg_catalog;

select cron.schedule(
  'expire-unpaid-orders',
  '*/5 * * * *',
  $$select public.expire_unpaid_orders()$$
);
