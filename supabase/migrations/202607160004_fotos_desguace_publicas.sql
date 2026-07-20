-- Las fotografías del desguace se publican en marketplaces y necesitan URLs estables.
-- Hacer público el bucket permite lectura sin token; escritura y borrado siguen usando políticas/API.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'almacen-desguace',
  'almacen-desguace',
  true,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update set
  public = true,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

notify pgrst, 'reload schema';
