-- =============================================================
-- Funções e triggers
-- =============================================================

-- -------------------------------------------------------------
-- Helpers
-- -------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.admin_users where user_id = (select auth.uid())
  );
$$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger store_settings_updated_at before update on public.store_settings
  for each row execute function public.set_updated_at();
create trigger whatsapp_templates_updated_at before update on public.whatsapp_templates
  for each row execute function public.set_updated_at();
create trigger categories_updated_at before update on public.categories
  for each row execute function public.set_updated_at();
create trigger products_updated_at before update on public.products
  for each row execute function public.set_updated_at();
create trigger delivery_zones_updated_at before update on public.delivery_zones
  for each row execute function public.set_updated_at();
create trigger orders_updated_at before update on public.orders
  for each row execute function public.set_updated_at();
create trigger custom_flavors_updated_at before update on public.custom_flavors
  for each row execute function public.set_updated_at();

-- -------------------------------------------------------------
-- Loja aberta agora? Interruptor manual E dentro do horário do dia
-- (fuso America/Sao_Paulo). Fonte única da regra, usada pelo site e
-- pela criação de pedidos.
-- -------------------------------------------------------------
create or replace function public.is_store_open_now()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  with local_now as (
    select (now() at time zone 'America/Sao_Paulo') as ts
  )
  select coalesce((
    select s.is_open_switch and exists (
      select 1
      from public.opening_hours h, local_now n
      where h.weekday = extract(dow from n.ts)::smallint
        and not h.is_closed
        and n.ts::time >= h.opens
        and n.ts::time < h.closes
    )
    from public.store_settings s
    where s.id
  ), false);
$$;

-- -------------------------------------------------------------
-- Fluxo de status
--   Entrega:  received → confirmed → out_for_delivery → completed
--   Retirada: received → confirmed → ready_for_pickup → completed
--   cancelled a partir de qualquer etapa antes de completed
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

create trigger orders_validate_status before update of status on public.orders
  for each row execute function public.validate_order_status_transition();

create or replace function public.log_order_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.order_status_history (order_id, from_status, to_status, changed_by)
    values (new.id, null, new.status, auth.uid());
  elsif new.status is distinct from old.status then
    insert into public.order_status_history (order_id, from_status, to_status, changed_by)
    values (new.id, old.status, new.status, auth.uid());
  end if;
  return new;
end;
$$;

create trigger orders_log_status after insert or update of status on public.orders
  for each row execute function public.log_order_status();

-- -------------------------------------------------------------
-- Criação de pedido (atômica). Chamada SOMENTE pelo servidor
-- (service_role), depois da validação Zod. Todos os valores são
-- recalculados a partir do banco; nada do front é confiável.
--
-- payload:
-- {
--   customer_name, customer_phone, fulfillment, payment_method,
--   change_for_cents?, notes?, ip_hash?,
--   delivery_zone_id?, cep?, street?, street_number?, complement?, address_reference?,
--   items: [{ product_id, quantity, note? }]
-- }
--
-- Erros (message): STORE_NOT_CONFIGURED, STORE_CLOSED, RATE_LIMITED,
--   INVALID_ITEMS, PRODUCT_UNAVAILABLE (detail = ids), BELOW_MINIMUM,
--   INVALID_ZONE, INVALID_CHANGE
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
  v_zone public.delivery_zones%rowtype;
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
    select * into v_zone
    from public.delivery_zones
    where id = nullif(payload ->> 'delivery_zone_id', '')::uuid and is_active;
    if not found then
      raise exception 'INVALID_ZONE';
    end if;
    v_fee := v_zone.fee_cents;
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
    case when v_fulfillment = 'delivery' then v_zone.id end,
    case when v_fulfillment = 'delivery' then v_zone.neighborhood end,
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

-- Funções nascem executáveis por PUBLIC; restringimos explicitamente.
revoke execute on function public.create_order(jsonb) from public, anon, authenticated;
grant execute on function public.create_order(jsonb) to service_role;

revoke execute on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated, service_role;

revoke execute on function public.is_store_open_now() from public;
grant execute on function public.is_store_open_now() to anon, authenticated, service_role;
