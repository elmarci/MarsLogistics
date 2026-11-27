-- MarsLogistics · Bucket privado para documentos (BL, DAM, facturas, GRE, actas...).
-- Solo el personal con permiso de escritura sube y borra archivos. Las descargas
-- se hacen con URLs firmadas que genera el servidor tras comprobar, con RLS,
-- que el usuario puede ver la fila de `documento`.
insert into storage.buckets (id, name, public)
values ('documentos', 'documentos', false)
on conflict (id) do nothing;

create policy documentos_lectura_interna on storage.objects for select
  using (bucket_id = 'documentos' and public.es_interno());

create policy documentos_subida on storage.objects for insert
  with check (bucket_id = 'documentos' and public.puede_escribir());

create policy documentos_borrado on storage.objects for delete
  using (bucket_id = 'documentos' and public.puede_escribir());
