-- =============================================================
-- Row Level Security
--   Público (anon): lê catálogo, sabores, galeria, bairros e
--   configurações públicas. Pedidos nunca são legíveis.
--   Admin (authenticated + admin_users): tudo que o painel precisa.
--   Servidor (service_role): ignora RLS; cria pedidos via create_order().
-- =============================================================

alter table public.store_settings enable row level security;
alter table public.opening_hours enable row level security;
alter table public.whatsapp_templates enable row level security;
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.delivery_zones enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.order_status_history enable row level security;
alter table public.custom_flavors enable row level security;
alter table public.custom_gallery enable row level security;
alter table public.admin_users enable row level security;

-- ---------- Configurações ----------
create policy "public read store_settings" on public.store_settings
  for select to anon, authenticated using (true);
create policy "admin update store_settings" on public.store_settings
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "public read opening_hours" on public.opening_hours
  for select to anon, authenticated using (true);
create policy "admin write opening_hours" on public.opening_hours
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "admin all whatsapp_templates" on public.whatsapp_templates
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---------- Catálogo ----------
create policy "public read active categories" on public.categories
  for select to anon, authenticated using (is_active or public.is_admin());
create policy "admin write categories" on public.categories
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "public read active products" on public.products
  for select to anon, authenticated using (is_active or public.is_admin());
create policy "admin write products" on public.products
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "public read active zones" on public.delivery_zones
  for select to anon, authenticated using (is_active or public.is_admin());
create policy "admin write zones" on public.delivery_zones
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---------- Encomendas ----------
create policy "public read active flavors" on public.custom_flavors
  for select to anon, authenticated using (is_active or public.is_admin());
create policy "admin write flavors" on public.custom_flavors
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "public read active gallery" on public.custom_gallery
  for select to anon, authenticated using (is_active or public.is_admin());
create policy "admin write gallery" on public.custom_gallery
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---------- Pedidos (somente admin; criação pelo servidor) ----------
create policy "admin read orders" on public.orders
  for select to authenticated using (public.is_admin());
create policy "admin update orders" on public.orders
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "admin read order_items" on public.order_items
  for select to authenticated using (public.is_admin());

create policy "admin read order_status_history" on public.order_status_history
  for select to authenticated using (public.is_admin());

-- O admin só pode alterar o status (e o acompanhamento) de um pedido;
-- valores, itens e dados da cliente ficam imutáveis pelo painel.
revoke insert, update, delete on public.orders from anon, authenticated;
grant update (status, wants_whatsapp_updates) on public.orders to authenticated;
revoke insert, update, delete on public.order_items from anon, authenticated;
revoke insert, update, delete on public.order_status_history from anon, authenticated;
revoke all on public.orders, public.order_items, public.order_status_history from anon;

-- ---------- Admins ----------
create policy "admin read own membership" on public.admin_users
  for select to authenticated using (user_id = (select auth.uid()));
revoke insert, update, delete on public.admin_users from anon, authenticated;
