-- =============================================================
-- Fase 2 — pagamento online (InfinitePay): novos valores de enum.
--
-- Ficam numa migration separada porque o Postgres não deixa usar um valor
-- de enum na mesma transação em que ele foi criado; a 0011 usa estes valores.
-- =============================================================

-- Pedido criado, esperando o pagamento online. Não aparece para a loja
-- como pedido novo até ser pago (vira 'received') ou expirar ('cancelled').
alter type public.order_status add value if not exists 'awaiting_payment' before 'received';

-- Pago online pelo checkout do gateway (Pix ou cartão).
alter type public.payment_method add value if not exists 'online';
