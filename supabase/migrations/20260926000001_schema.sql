-- =============================================================
-- Schema principal do cardápio digital (Fase 1)
-- Valores monetários sempre em centavos (integer).
-- =============================================================

create type public.fulfillment_type as enum ('delivery', 'pickup');

create type public.order_status as enum (
  'received',
  'confirmed',
  'out_for_delivery',
  'ready_for_pickup',
  'completed',
  'cancelled'
);

create type public.payment_method as enum ('pix_on_delivery', 'cash', 'card_on_delivery');

-- Previsto para a Fase 2 (pagamento online). Na Fase 1 todo pedido nasce 'pending'.
create type public.payment_status as enum ('pending', 'paid', 'refunded', 'not_applicable');

-- -------------------------------------------------------------
-- Configurações da loja (linha única)
-- -------------------------------------------------------------
create table public.store_settings (
  id boolean primary key default true check (id),
  name text not null,
  tagline text,
  logo_path text,
  whatsapp text not null check (whatsapp ~ '^55[0-9]{10,11}$'),
  pickup_address text,
  instagram_handle text,
  is_open_switch boolean not null default true,
  min_order_cents integer not null default 0 check (min_order_cents >= 0),
  custom_intro text,
  custom_min_quantity integer check (custom_min_quantity is null or custom_min_quantity > 0),
  custom_min_lead_days integer check (custom_min_lead_days is null or custom_min_lead_days >= 0),
  updated_at timestamptz not null default now()
);

-- 0 = domingo ... 6 = sábado (mesma convenção de extract(dow))
create table public.opening_hours (
  weekday smallint primary key check (weekday between 0 and 6),
  is_closed boolean not null default false,
  opens time,
  closes time,
  constraint opening_hours_valid check (
    is_closed or (opens is not null and closes is not null and closes > opens)
  )
);

-- Textos das mensagens de WhatsApp por status.
-- Placeholders aceitos: {nome}, {numero}, {total}, {loja}, {endereco_retirada}
create table public.whatsapp_templates (
  status public.order_status primary key,
  body text not null check (length(body) between 1 and 1000),
  updated_at timestamptz not null default now()
);

-- -------------------------------------------------------------
-- Catálogo de pronta entrega
-- -------------------------------------------------------------
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(name) between 1 and 80),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.categories (id) on delete restrict,
  name text not null check (length(name) between 1 and 120),
  description text check (description is null or length(description) <= 500),
  price_cents integer not null check (price_cents >= 0),
  image_path text,
  sort_order integer not null default 0,
  is_active boolean not null default true,     -- aparece no cardápio
  is_available boolean not null default true,  -- false = "Esgotado"
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index products_category_idx on public.products (category_id, sort_order);

-- -------------------------------------------------------------
-- Bairros atendidos
-- -------------------------------------------------------------
create table public.delivery_zones (
  id uuid primary key default gen_random_uuid(),
  neighborhood text not null unique check (length(neighborhood) between 1 and 80),
  fee_cents integer not null check (fee_cents >= 0),
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- -------------------------------------------------------------
-- Pedidos
-- -------------------------------------------------------------
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  number bigint generated always as identity (start with 100) unique,

  customer_name text not null check (length(customer_name) between 2 and 100),
  customer_phone text not null check (customer_phone ~ '^[0-9]{10,11}$'), -- DDD + número, sem 55

  fulfillment public.fulfillment_type not null,
  delivery_zone_id uuid references public.delivery_zones (id) on delete set null,
  zone_name_snapshot text,
  cep text check (cep is null or cep ~ '^[0-9]{8}$'),
  street text,
  street_number text,
  complement text,
  address_reference text,

  subtotal_cents integer not null check (subtotal_cents >= 0),
  delivery_fee_cents integer not null default 0 check (delivery_fee_cents >= 0),
  total_cents integer not null check (total_cents >= 0),

  payment_method public.payment_method not null,
  change_for_cents integer check (change_for_cents is null or change_for_cents > 0),
  payment_status public.payment_status not null default 'pending',
  payment_provider text,   -- Fase 2
  payment_reference text,  -- Fase 2 (id da cobrança no gateway)

  notes text check (notes is null or length(notes) <= 500),
  status public.order_status not null default 'received',
  wants_whatsapp_updates boolean not null default false,
  ip_hash text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint orders_delivery_address check (
    fulfillment = 'pickup'
    or (zone_name_snapshot is not null and street is not null and street_number is not null)
  ),
  constraint orders_status_matches_fulfillment check (
    not (fulfillment = 'delivery' and status = 'ready_for_pickup')
    and not (fulfillment = 'pickup' and status = 'out_for_delivery')
  ),
  constraint orders_change_only_cash check (payment_method = 'cash' or change_for_cents is null)
);
create index orders_created_idx on public.orders (created_at desc);
create index orders_status_idx on public.orders (status, created_at desc);
create index orders_ip_hash_idx on public.orders (ip_hash, created_at desc);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  product_id uuid references public.products (id) on delete set null,
  name_snapshot text not null,
  unit_price_cents integer not null check (unit_price_cents >= 0),
  quantity integer not null check (quantity between 1 and 99),
  line_total_cents integer not null check (line_total_cents >= 0),
  note text check (note is null or length(note) <= 200),
  sort_order integer not null default 0
);
create index order_items_order_idx on public.order_items (order_id, sort_order);

create table public.order_status_history (
  id bigint generated always as identity primary key,
  order_id uuid not null references public.orders (id) on delete cascade,
  from_status public.order_status,
  to_status public.order_status not null,
  changed_by uuid,
  changed_at timestamptz not null default now()
);
create index order_status_history_order_idx on public.order_status_history (order_id, changed_at);

-- -------------------------------------------------------------
-- Encomendas para festa (portfólio)
-- -------------------------------------------------------------
create table public.custom_flavors (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(name) between 1 and 80),
  description text check (description is null or length(description) <= 500),
  image_path text,
  highlights text[] not null default '{}',
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.custom_gallery (
  id uuid primary key default gen_random_uuid(),
  image_path text not null,
  caption text check (caption is null or length(caption) <= 200),
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- -------------------------------------------------------------
-- Administradores (usuários do Supabase Auth autorizados no painel)
-- -------------------------------------------------------------
create table public.admin_users (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
