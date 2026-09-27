-- =============================================================
-- Storage (fotos) e Realtime (pedidos novos no painel)
-- =============================================================

-- Bucket público de leitura: as fotos são servidas por URL pública.
-- Sem policy de SELECT em storage.objects, ninguém consegue LISTAR o bucket.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('images', 'images', true, 5242880, array['image/webp', 'image/jpeg', 'image/png'])
on conflict (id) do nothing;

create policy "admin upload images" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'images' and public.is_admin());

create policy "admin update images" on storage.objects
  for update to authenticated
  using (bucket_id = 'images' and public.is_admin())
  with check (bucket_id = 'images' and public.is_admin());

create policy "admin delete images" on storage.objects
  for delete to authenticated
  using (bucket_id = 'images' and public.is_admin());

-- Realtime respeita RLS: só admins recebem eventos de pedidos.
alter publication supabase_realtime add table public.orders;
