-- Corrige el guardado del plano en bases de datos que bloquean DELETE sin WHERE.
-- Se mantiene como migración separada porque 202607210001 puede estar ya aplicada.

create or replace function public.almacen_desguace_guardar_plano(elementos jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if jsonb_typeof(elementos) <> 'array' or jsonb_array_length(elementos) > 100 then
    raise exception 'La distribución del plano no es válida.';
  end if;

  delete from public.almacen_desguace_plano_elementos
  where id is not null;

  insert into public.almacen_desguace_plano_elementos (
    tipo, codigo_estanteria, nombre, x, y, ancho, alto, rotacion, color, orden
  )
  select
    item.tipo,
    nullif(item.codigo_estanteria, ''),
    coalesce(item.nombre, ''),
    item.x,
    item.y,
    item.ancho,
    item.alto,
    item.rotacion,
    item.color,
    item.orden
  from jsonb_to_recordset(elementos) as item(
    tipo text,
    codigo_estanteria text,
    nombre text,
    x numeric,
    y numeric,
    ancho numeric,
    alto numeric,
    rotacion integer,
    color text,
    orden integer
  );
end;
$$;

revoke all on function public.almacen_desguace_guardar_plano(jsonb) from public;
grant execute on function public.almacen_desguace_guardar_plano(jsonb) to anon, authenticated;

notify pgrst, 'reload schema';
