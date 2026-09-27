-- =============================================================
-- O Storage exige SELECT além de DELETE para remover arquivos
-- (storage.remove() consulta os objetos antes de apagar).
-- Liberamos a leitura de storage.objects só para o admin; o público
-- continua vendo as fotos pela URL pública, sem conseguir listar o bucket.
-- =============================================================

create policy "admin read images" on storage.objects
  for select to authenticated
  using (bucket_id = 'images' and public.is_admin());
