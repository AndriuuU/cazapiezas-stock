-- Conserva el identificador real con el que cada pieza existe en Recambio Fácil.
-- Las importaciones antiguas desde CAT utilizaban la referencia interna como
-- código; las altas nuevas por API guardarán el código generado al publicarse.

alter table public.almacen_desguace_piezas
  add column if not exists codigo_recambio_facil text;

comment on column public.almacen_desguace_piezas.codigo_recambio_facil is
  'Código real usado para consultar, actualizar o eliminar la pieza mediante la API de Recambio Fácil.';

-- Si las observaciones locales conservan "CAT: código", se utiliza ese valor.
update public.almacen_desguace_piezas
set codigo_recambio_facil = nullif(
  btrim(substring(descripcion from '(?i)CAT:[[:space:]]*([[:alnum:]_-]+)')),
  ''
)
where codigo_recambio_facil is null
  and publicado_online = true
  and descripcion ~* 'CAT:[[:space:]]*[[:alnum:]_-]+';

-- En el fichero CAT histórico, la referencia principal era el código interno
-- que quedó indicado en Recambio Fácil como "Referencia interna CAT: ...".
update public.almacen_desguace_piezas
set codigo_recambio_facil = nullif(btrim(referencia_principal), '')
where codigo_recambio_facil is null
  and publicado_online = true
  and procedencia like 'CAT stockcat.csv%';

create index if not exists almacen_desguace_piezas_codigo_rf_idx
  on public.almacen_desguace_piezas (codigo_recambio_facil)
  where codigo_recambio_facil is not null;

-- La acción "Ya Online" vincula de una vez las piezas que fueron publicadas
-- fuera de la API. En esas publicaciones el código era la referencia interna.
create or replace function public.almacen_desguace_confirmar_online_rf(p_ids bigint[])
returns table(id bigint)
language sql
security invoker
set search_path = public
as $$
  update public.almacen_desguace_piezas as pieza
  set publicado_online = true,
      codigo_recambio_facil = coalesce(
        nullif(btrim(pieza.codigo_recambio_facil), ''),
        nullif(btrim(pieza.referencia_principal), '')
      )
  where pieza.id = any(p_ids)
  returning pieza.id;
$$;

grant execute on function public.almacen_desguace_confirmar_online_rf(bigint[])
  to anon, authenticated;

notify pgrst, 'reload schema';
