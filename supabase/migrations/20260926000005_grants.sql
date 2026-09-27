-- =============================================================
-- Privilégios explícitos da Data API.
-- O projeto é criado com "Automatically expose new tables" DESLIGADO,
-- então nenhuma tabela nasce acessível: liberamos aqui só o necessário.
-- O RLS (migration 0003) continua filtrando as linhas de cada papel.
-- =============================================================

grant usage on schema public to anon, authenticated, service_role;

-- Leitura pública: catálogo, encomendas, bairros e configurações
grant select on
  public.store_settings,
  public.opening_hours,
  public.categories,
  public.products,
  public.delivery_zones,
  public.custom_flavors,
  public.custom_gallery
to anon, authenticated;

-- Painel admin (RLS exige is_admin())
grant select, insert, update, delete on
  public.opening_hours,
  public.whatsapp_templates,
  public.categories,
  public.products,
  public.delivery_zones,
  public.custom_flavors,
  public.custom_gallery
to authenticated;
grant update on public.store_settings to authenticated;

-- Pedidos: admin só lê e muda status/acompanhamento (criação é via create_order)
grant select on public.orders, public.order_items, public.order_status_history to authenticated;
grant update (status, wants_whatsapp_updates) on public.orders to authenticated;

grant select on public.admin_users to authenticated;

-- Servidor (service_role): acesso total; ele já ignora RLS.
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
