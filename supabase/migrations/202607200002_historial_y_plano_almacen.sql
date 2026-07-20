-- Historial completo de ubicaciones y organización del plano por zonas.

alter table public.almacen_desguace_estanterias
  add column if not exists zona text not null default 'Sin zona',
  add column if not exists orden_plano integer not null default 0;

alter table public.almacen_desguace_ubicaciones_movimientos
  add column if not exists ubicacion_anterior text,
  add column if not exists tipo_movimiento text not null default 'colocacion',
  add column if not exists usuario_nombre text not null default 'Usuario de almacén',
  add column if not exists origen text not null default 'app';

update public.almacen_desguace_ubicaciones_movimientos
set tipo_movimiento = 'incidencia'
where resultado = 'no_colocada';

alter table public.almacen_desguace_ubicaciones_movimientos
  drop constraint if exists almacen_desguace_movimiento_resultado_check,
  drop constraint if exists almacen_desguace_movimiento_confirmacion_check,
  drop constraint if exists almacen_desguace_movimiento_ubicaciones_check;

alter table public.almacen_desguace_ubicaciones_movimientos
  add constraint almacen_desguace_movimiento_resultado_check check (
    resultado in (
      'colocada_sugerida', 'colocada_alternativa', 'no_colocada',
      'movida', 'retirada_ubicacion'
    )
  ),
  add constraint almacen_desguace_movimiento_tipo_check check (
    tipo_movimiento in ('colocacion', 'traslado', 'retirada', 'incidencia')
  ),
  add constraint almacen_desguace_movimiento_ubicaciones_check check (
    (ubicacion_anterior is null or ubicacion_anterior ~ '^DESGUACE-E[0-9]{2}-N[0-9]{2}-C[0-9]{2}$')
    and (ubicacion_sugerida is null or ubicacion_sugerida ~ '^DESGUACE-E[0-9]{2}-N[0-9]{2}-C[0-9]{2}$')
    and (ubicacion_final is null or ubicacion_final ~ '^DESGUACE-E[0-9]{2}-N[0-9]{2}-C[0-9]{2}$')
  ),
  add constraint almacen_desguace_movimiento_confirmacion_check check (
    (resultado = 'no_colocada' and ubicacion_final is null and nullif(btrim(motivo), '') is not null)
    or (resultado in ('colocada_sugerida', 'colocada_alternativa', 'movida') and ubicacion_final is not null)
    or (resultado = 'retirada_ubicacion' and ubicacion_anterior is not null and ubicacion_final is null)
  );

create index if not exists almacen_desguace_movimientos_fecha_idx
  on public.almacen_desguace_ubicaciones_movimientos (created_at desc);
create index if not exists almacen_desguace_estanterias_zona_idx
  on public.almacen_desguace_estanterias (zona, orden_plano, codigo);

create or replace function public.almacen_desguace_registrar_cambio_ubicacion()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  movimiento_resultado text;
  movimiento_tipo text;
begin
  if tg_op = 'INSERT' then
    if new.ubicacion is null then
      return new;
    end if;
    movimiento_resultado := 'colocada_alternativa';
    movimiento_tipo := 'colocacion';
  elsif old.ubicacion is not distinct from new.ubicacion then
    return new;
  elsif new.ubicacion is null then
    movimiento_resultado := 'retirada_ubicacion';
    movimiento_tipo := 'retirada';
  elsif old.ubicacion is null then
    movimiento_resultado := 'colocada_alternativa';
    movimiento_tipo := 'colocacion';
  else
    movimiento_resultado := 'movida';
    movimiento_tipo := 'traslado';
  end if;

  insert into public.almacen_desguace_ubicaciones_movimientos (
    pieza_id,
    ubicacion_anterior,
    resultado,
    ubicacion_final,
    tipo_movimiento,
    usuario_nombre,
    origen
  ) values (
    new.id,
    case when tg_op = 'UPDATE' then old.ubicacion else null end,
    movimiento_resultado,
    new.ubicacion,
    movimiento_tipo,
    'Usuario de almacén',
    'cambio automático'
  );

  return new;
end;
$$;

drop trigger if exists almacen_desguace_historial_ubicacion
  on public.almacen_desguace_piezas;
create trigger almacen_desguace_historial_ubicacion
after insert or update of ubicacion on public.almacen_desguace_piezas
for each row execute function public.almacen_desguace_registrar_cambio_ubicacion();

comment on column public.almacen_desguace_estanterias.zona is
  'Zona o pasillo utilizado para agrupar la estantería en el plano general.';
comment on column public.almacen_desguace_estanterias.orden_plano is
  'Orden visual de la estantería dentro de su zona.';

notify pgrst, 'reload schema';
