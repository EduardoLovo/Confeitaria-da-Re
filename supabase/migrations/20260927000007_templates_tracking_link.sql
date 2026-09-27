-- =============================================================
-- Novo placeholder {link}: link da página de acompanhamento do pedido.
-- Acrescenta "Acompanhe: {link}" ao fim das mensagens dos status em
-- andamento (sem apagar o que a loja já escreveu). Idempotente.
-- =============================================================

update public.whatsapp_templates
set body = body || E'\n\nAcompanhe: {link}'
where status in ('received', 'confirmed', 'out_for_delivery', 'ready_for_pickup')
  and body not like '%{link}%';
