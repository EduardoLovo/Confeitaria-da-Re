-- =============================================================
-- Frete fixo + bairro digitado pelo cliente.
--
-- Antes: o cliente escolhia um bairro cadastrado (delivery_zones) e a taxa
-- vinha do bairro. Agora: o cliente digita o bairro e a taxa é única para
-- todos os endereços, definida no painel (store_settings.delivery_fee_cents).
--
-- A tabela delivery_zones fica no banco (pedidos antigos apontam para ela),
-- mas não é mais usada por create_order().
-- =============================================================

alter table public.store_settings
  add column delivery_fee_cents integer not null default 0 check (delivery_fee_cents >= 0);

-- Valor inicial: a maior taxa entre os bairros ativos (ajuste depois no painel).
update public.store_settings
set delivery_fee_cents = coalesce((select max(fee_cents) from public.delivery_zones where is_active), 0);

-- -------------------------------------------------------------
-- create_order(payload): igual à anterior, mas na entrega usa
-- payload.neighborhood (texto livre, 2–80 caracteres) e a taxa fixa.
--
-- payload:
-- {
--   customer_name, customer_phone, fulfillment, payment_method,
--   change_for_cents?, notes?, ip_hash?,
--   neighborhood?, cep?, street?, street_number?, complement?, address_reference?,
--   items: [{ product_id, quantity, note? }]
-- }
--
-- Erros (message): STORE_NOT_CONFIGURED, STORE_CLOSED, RATE_LIMITED,
--   INVALID_ITEMS, PRODUCT_UNAVAILABLE (detail = ids), BELOW_MINIMUM,
--   INVALID_ADDRESS, INVALID_CHANGE
-- -------------------------------------------------------------
create or replace function public.create_order(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_settings public.store_settings%rowtype;
  v_fulfillment public.fulfillment_type := (payload ->> 'fulfillment')::public.fulfillment_type;
  v_payment public.payment_method := (payload ->> 'payment_method')::public.payment_method;
  v_ip_hash text := nullif(payload ->> 'ip_hash', '');
  v_items jsonb := payload -> 'items';
  v_change integer := nullif(payload ->> 'change_for_cents', '')::integer;
  v_neighborhood text := nullif(btrim(payload ->> 'neighborhood'), '');
  v_fee integer := 0;
  v_subtotal integer;
  v_total integer;
  v_missing text;
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

  insert into public.orders (
    customer_name, customer_phone, fulfillment,
    delivery_zone_id, zone_name_snapshot, cep, street, street_number, complement, address_reference,
    subtotal_cents, delivery_fee_cents, total_cents,
    payment_method, change_for_cents, notes, ip_hash
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
    v_ip_hash
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

  return jsonb_build_object('id', v_order_id, 'number', v_number);
end;
$$;

revoke execute on function public.create_order(jsonb) from public, anon, authenticated;
grant execute on function public.create_order(jsonb) to service_role;
