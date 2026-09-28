-- =============================================================
-- Dados de exemplo — substitua pelos dados reais no painel admin.
-- Idempotente o bastante para rodar num banco recém-migrado.
-- =============================================================

insert into public.store_settings (
  id, name, tagline, whatsapp, pickup_address, instagram_handle,
  is_open_switch, min_order_cents, delivery_fee_cents,
  custom_intro, custom_min_quantity, custom_min_lead_days
) values (
  true,
  'Confeitaria da Re',
  'Docinhos artesanais feitos com carinho',
  '5511999999999',
  'Rua das Flores, 123 — Vila Mariana, São Paulo/SP',
  null, -- @ do Instagram: preencha no painel admin
  true,
  3000,
  800,
  'Fazemos docinhos personalizados para aniversários, casamentos, chás e batizados. '
    || 'Cada encomenda é pensada junto com você: sabores, cores das forminhas e decoração combinando com o tema da festa.',
  50,
  7
) on conflict (id) do nothing;

-- Ter–sáb 10h–19h
insert into public.opening_hours (weekday, is_closed, opens, closes) values
  (0, true,  null,    null),
  (1, true,  null,    null),
  (2, false, '10:00', '19:00'),
  (3, false, '10:00', '19:00'),
  (4, false, '10:00', '19:00'),
  (5, false, '10:00', '19:00'),
  (6, false, '10:00', '19:00')
on conflict (weekday) do nothing;

insert into public.whatsapp_templates (status, body) values
  ('received',         E'Oi, {nome}! Recebemos seu pedido #{numero} 💕 Já já confirmamos por aqui.\n\nAcompanhe: {link}'),
  ('confirmed',        E'Oi, {nome}! Seu pedido #{numero} foi confirmado e já está sendo preparado com carinho 🍫 Total: {total}.\n\nAcompanhe: {link}'),
  ('out_for_delivery', E'Oba, {nome}! Seu pedido #{numero} saiu para entrega 🛵 Logo chega aí!\n\nAcompanhe: {link}'),
  ('ready_for_pickup', E'Oi, {nome}! Seu pedido #{numero} está pronto para retirada em {endereco_retirada} 🎀\n\nAcompanhe: {link}'),
  ('completed',        'Obrigada, {nome}! Pedido #{numero} concluído. Esperamos que você ame seus docinhos 💖'),
  ('cancelled',        'Oi, {nome}. Seu pedido #{numero} foi cancelado. Qualquer dúvida, é só chamar aqui 🙏')
on conflict (status) do nothing;

insert into public.categories (name, slug, sort_order) values
  ('Brigadeiros gourmet', 'brigadeiros-gourmet', 1),
  ('Docinhos clássicos',  'docinhos-classicos',  2),
  ('Trufas e bombons',    'trufas-e-bombons',    3),
  ('Caixas presenteáveis','caixas-presenteaveis',4)
on conflict (slug) do nothing;

insert into public.products (category_id, name, description, price_cents, sort_order, is_available)
select c.id, p.name, p.description, p.price_cents, p.sort_order, p.is_available
from (values
  ('brigadeiros-gourmet', 'Brigadeiro de chocolate belga', 'Chocolate belga 54% cacau com granulado belga.', 450, 1, true),
  ('brigadeiros-gourmet', 'Brigadeiro de ninho com Nutella', 'Leite Ninho cremoso com recheio de Nutella.', 500, 2, true),
  ('brigadeiros-gourmet', 'Brigadeiro de pistache', 'Pistache de verdade, finalizado com pistache triturado.', 650, 3, true),
  ('brigadeiros-gourmet', 'Brigadeiro de café', 'Café especial e chocolate meio amargo.', 450, 4, false),
  ('docinhos-classicos',  'Beijinho', 'Coco fresco ralado e cravo-da-índia.', 400, 1, true),
  ('docinhos-classicos',  'Cajuzinho', 'Amendoim torrado e chocolate, com meia castanha.', 400, 2, true),
  ('docinhos-classicos',  'Olho de sogra', 'Ameixa recheada com doce de coco.', 450, 3, true),
  ('docinhos-classicos',  'Casadinho', 'Metade brigadeiro, metade beijinho.', 450, 4, true),
  ('trufas-e-bombons',    'Trufa de maracujá', 'Ganache de maracujá coberta com chocolate ao leite.', 700, 1, true),
  ('trufas-e-bombons',    'Bombom de morango', 'Morango inteiro, brigadeiro branco e casquinha de chocolate.', 900, 2, true),
  ('caixas-presenteaveis','Caixa com 6 docinhos', 'Sortidos à escolha da casa, em caixa presenteável com laço.', 2700, 1, true),
  ('caixas-presenteaveis','Caixa com 12 docinhos', 'Sortidos à escolha da casa, em caixa presenteável com laço.', 5200, 2, true)
) as p(category_slug, name, description, price_cents, sort_order, is_available)
join public.categories c on c.slug = p.category_slug
where not exists (select 1 from public.products);

insert into public.custom_flavors (name, description, highlights, sort_order)
select * from (values
  ('Brigadeiro tradicional', 'O clássico que não pode faltar em nenhuma festa.', array['Chocolate belga', 'Granulado belga'], 1),
  ('Beijinho', 'Coco fresco, delicado e macio.', array['Coco fresco', 'Cravo opcional'], 2),
  ('Ninho com Nutella', 'Queridinho da criançada (e dos adultos também).', array['Leite Ninho', 'Nutella original'], 3),
  ('Pistache', 'Sofisticado e marcante, ótimo para casamentos.', array['Pistache siciliano'], 4),
  ('Limão siciliano', 'Refrescante, com raspas de limão siciliano.', array['Raspas frescas', 'Chocolate branco'], 5),
  ('Churros', 'Doce de leite com canela, envolto em açúcar e canela.', array['Doce de leite artesanal', 'Canela do Ceilão'], 6)
) as f(name, description, highlights, sort_order)
where not exists (select 1 from public.custom_flavors);

-- A galeria começa vazia: envie as fotos reais pelo painel (Admin → Encomendas → Galeria).
