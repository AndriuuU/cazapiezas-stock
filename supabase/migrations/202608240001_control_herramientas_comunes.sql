-- Control de préstamos largos, archivo recuperable, incidencias e historial completo.
alter table public.herramientas_comunes_herramientas
  add column if not exists archivada boolean not null default false,
  add column if not exists archivada_at timestamptz,
  add column if not exists archivada_por text,
  add column if not exists motivo_archivo text,
  add column if not exists incidencia_abierta_tipo text,
  add column if not exists incidencia_abierta_detalle text,
  add column if not exists incidencia_abierta_at timestamptz;

alter table public.herramientas_comunes_herramientas
  drop constraint if exists herramientas_comunes_incidencia_tipo_check;
alter table public.herramientas_comunes_herramientas
  add constraint herramientas_comunes_incidencia_tipo_check
  check (incidencia_abierta_tipo is null or incidencia_abierta_tipo in ('falta_pieza', 'danada', 'revision'));
alter table public.herramientas_comunes_herramientas
  drop constraint if exists herramientas_comunes_archivada_no_prestada_check;
alter table public.herramientas_comunes_herramientas
  add constraint herramientas_comunes_archivada_no_prestada_check
  check (not archivada or estado <> 'prestada');
alter table public.herramientas_comunes_herramientas
  drop constraint if exists herramientas_comunes_incidencia_no_prestada_check;
alter table public.herramientas_comunes_herramientas
  add constraint herramientas_comunes_incidencia_no_prestada_check
  check (incidencia_abierta_tipo is null or estado <> 'prestada');

create index if not exists herramientas_comunes_archivada_idx
  on public.herramientas_comunes_herramientas (archivada, nombre);
create index if not exists herramientas_comunes_prestadas_fecha_idx
  on public.herramientas_comunes_herramientas (retirada_at)
  where estado = 'prestada' and archivada = false;

alter table public.herramientas_comunes_movimientos
  add column if not exists incidencia_tipo text,
  add column if not exists foto_url text,
  add column if not exists storage_path text;

alter table public.herramientas_comunes_movimientos
  drop constraint if exists herramientas_comunes_movimientos_tipo_check;
alter table public.herramientas_comunes_movimientos
  add constraint herramientas_comunes_movimientos_tipo_check
  check (tipo in ('alta', 'retirada', 'devolucion', 'cambio_estado', 'cambio_ubicacion', 'edicion', 'foto', 'incidencia', 'incidencia_resuelta', 'archivo', 'restauracion'));
alter table public.herramientas_comunes_movimientos
  drop constraint if exists herramientas_comunes_movimientos_incidencia_tipo_check;
alter table public.herramientas_comunes_movimientos
  add constraint herramientas_comunes_movimientos_incidencia_tipo_check
  check (incidencia_tipo is null or incidencia_tipo in ('falta_pieza', 'danada', 'revision'));

create index if not exists herramientas_comunes_movimientos_historial_idx
  on public.herramientas_comunes_movimientos (herramienta_id, id desc);

create or replace function public.herramientas_comunes_devolver_con_incidencia(
  p_herramienta_id bigint,
  p_empleado text,
  p_incidencia_tipo text default null,
  p_incidencia_detalle text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  anterior public.herramientas_comunes_herramientas%rowtype;
  actualizada public.herramientas_comunes_herramientas%rowtype;
  empleado_limpio text := nullif(btrim(coalesce(p_empleado, '')), '');
  tipo_limpio text := nullif(btrim(coalesce(p_incidencia_tipo, '')), '');
  detalle_limpio text := nullif(btrim(coalesce(p_incidencia_detalle, '')), '');
  incidencia_id bigint;
begin
  select * into anterior from public.herramientas_comunes_herramientas
  where id = p_herramienta_id for update;
  if not found then raise exception 'Herramienta no encontrada.'; end if;
  if anterior.archivada then raise exception 'La herramienta está archivada.'; end if;
  if anterior.estado <> 'prestada' then raise exception 'La herramienta no figura como prestada.'; end if;
  empleado_limpio := coalesce(empleado_limpio, anterior.empleado_actual);
  if empleado_limpio is null then raise exception 'Selecciona el empleado que la coloca.'; end if;
  if tipo_limpio is not null and tipo_limpio not in ('falta_pieza', 'danada', 'revision') then
    raise exception 'Tipo de incidencia no válido.';
  end if;

  update public.herramientas_comunes_herramientas
  set estado = 'disponible', empleado_actual = null, vehiculo_actual = null,
      retirada_at = null,
      incidencia_abierta_tipo = tipo_limpio,
      incidencia_abierta_detalle = case when tipo_limpio is null then null else detalle_limpio end,
      incidencia_abierta_at = case when tipo_limpio is null then null else now() end
  where id = anterior.id returning * into actualizada;

  insert into public.herramientas_comunes_movimientos
    (herramienta_id, tipo, empleado, vehiculo, estado_anterior, estado_nuevo)
  values (anterior.id, 'devolucion', empleado_limpio, anterior.vehiculo_actual, anterior.estado, 'disponible');

  if tipo_limpio is not null then
    insert into public.herramientas_comunes_movimientos
      (herramienta_id, tipo, empleado, vehiculo, estado_anterior, estado_nuevo, detalle, incidencia_tipo)
    values (anterior.id, 'incidencia', empleado_limpio, anterior.vehiculo_actual, 'disponible', 'disponible', detalle_limpio, tipo_limpio)
    returning id into incidencia_id;
  end if;

  return jsonb_build_object('herramienta', to_jsonb(actualizada), 'incidencia_movimiento_id', incidencia_id);
end;
$$;

create or replace function public.herramientas_comunes_archivar(
  p_herramienta_id bigint,
  p_archivar boolean,
  p_empleado text,
  p_motivo text default null
)
returns public.herramientas_comunes_herramientas
language plpgsql
security definer
set search_path = public
as $$
declare
  anterior public.herramientas_comunes_herramientas%rowtype;
  actualizada public.herramientas_comunes_herramientas%rowtype;
  empleado_limpio text := nullif(btrim(coalesce(p_empleado, '')), '');
  motivo_limpio text := nullif(btrim(coalesce(p_motivo, '')), '');
begin
  select * into anterior from public.herramientas_comunes_herramientas
  where id = p_herramienta_id for update;
  if not found then raise exception 'Herramienta no encontrada.'; end if;
  if empleado_limpio is null then raise exception 'No se ha identificado al administrador.'; end if;
  if p_archivar and anterior.estado = 'prestada' then raise exception 'Devuelve la herramienta antes de archivarla.'; end if;
  if p_archivar = anterior.archivada then
    if p_archivar then raise exception 'La herramienta ya está archivada.';
    else raise exception 'La herramienta no está archivada.';
    end if;
  end if;

  update public.herramientas_comunes_herramientas
  set archivada = p_archivar,
      archivada_at = case when p_archivar then now() else null end,
      archivada_por = case when p_archivar then empleado_limpio else null end,
      motivo_archivo = case when p_archivar then motivo_limpio else null end
  where id = anterior.id returning * into actualizada;

  insert into public.herramientas_comunes_movimientos
    (herramienta_id, tipo, empleado, estado_anterior, estado_nuevo, detalle)
  values (anterior.id, case when p_archivar then 'archivo' else 'restauracion' end,
          empleado_limpio, anterior.estado, anterior.estado,
          case when p_archivar then motivo_limpio else 'Herramienta restaurada al inventario activo.' end);
  return actualizada;
end;
$$;

create or replace function public.herramientas_comunes_resolver_incidencia(
  p_herramienta_id bigint,
  p_empleado text,
  p_detalle text default null
)
returns public.herramientas_comunes_herramientas
language plpgsql
security definer
set search_path = public
as $$
declare
  anterior public.herramientas_comunes_herramientas%rowtype;
  actualizada public.herramientas_comunes_herramientas%rowtype;
begin
  select * into anterior from public.herramientas_comunes_herramientas
  where id = p_herramienta_id for update;
  if not found then raise exception 'Herramienta no encontrada.'; end if;
  if anterior.incidencia_abierta_tipo is null then raise exception 'La herramienta no tiene ninguna incidencia abierta.'; end if;
  update public.herramientas_comunes_herramientas
  set incidencia_abierta_tipo = null, incidencia_abierta_detalle = null, incidencia_abierta_at = null
  where id = anterior.id returning * into actualizada;
  insert into public.herramientas_comunes_movimientos
    (herramienta_id, tipo, empleado, estado_anterior, estado_nuevo, detalle, incidencia_tipo)
  values (anterior.id, 'incidencia_resuelta', nullif(btrim(coalesce(p_empleado, '')), ''),
          anterior.estado, anterior.estado, nullif(btrim(coalesce(p_detalle, '')), ''), anterior.incidencia_abierta_tipo);
  return actualizada;
end;
$$;

create or replace function public.herramientas_comunes_asociar_foto_incidencia(
  p_herramienta_id bigint,
  p_movimiento_id bigint,
  p_foto_url text,
  p_storage_path text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  filas_actualizadas integer;
begin
  if nullif(btrim(coalesce(p_foto_url, '')), '') is null
     or nullif(btrim(coalesce(p_storage_path, '')), '') is null then
    raise exception 'La fotografía no es válida.';
  end if;

  update public.herramientas_comunes_movimientos
  set foto_url = p_foto_url,
      storage_path = p_storage_path
  where id = p_movimiento_id
    and herramienta_id = p_herramienta_id
    and tipo = 'incidencia'
    and foto_url is null;

  get diagnostics filas_actualizadas = row_count;
  return filas_actualizadas = 1;
end;
$$;

revoke all on function public.herramientas_comunes_devolver_con_incidencia(bigint, text, text, text) from public, anon, authenticated;
revoke all on function public.herramientas_comunes_archivar(bigint, boolean, text, text) from public, anon, authenticated;
revoke all on function public.herramientas_comunes_resolver_incidencia(bigint, text, text) from public, anon, authenticated;
revoke all on function public.herramientas_comunes_asociar_foto_incidencia(bigint, bigint, text, text) from public, anon, authenticated;
grant execute on function public.herramientas_comunes_devolver_con_incidencia(bigint, text, text, text) to service_role;
grant execute on function public.herramientas_comunes_archivar(bigint, boolean, text, text) to service_role;
grant execute on function public.herramientas_comunes_resolver_incidencia(bigint, text, text) to service_role;
grant execute on function public.herramientas_comunes_asociar_foto_incidencia(bigint, bigint, text, text) to service_role;
