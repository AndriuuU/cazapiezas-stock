-- Cada empleado puede tener como máximo tres herramientas comunes prestadas.
-- El bloqueo por empleado evita superar el límite con retiradas simultáneas.
create index if not exists herramientas_comunes_prestadas_empleado_idx
  on public.herramientas_comunes_herramientas ((lower(btrim(empleado_actual))))
  where estado = 'prestada' and empleado_actual is not null;

create or replace function public.herramientas_comunes_cambiar_estado(
  p_herramienta_id bigint,
  p_accion text,
  p_empleado text default null,
  p_vehiculo text default null,
  p_estado_nuevo text default null
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
  vehiculo_limpio text := nullif(btrim(coalesce(p_vehiculo, '')), '');
  prestamos_activos integer;
begin
  select * into anterior
  from public.herramientas_comunes_herramientas
  where id = p_herramienta_id
  for update;

  if not found then raise exception 'Herramienta no encontrada.'; end if;

  if p_accion = 'retirar' then
    if anterior.estado <> 'disponible' then raise exception 'La herramienta ya no está disponible.'; end if;
    if empleado_limpio is null then raise exception 'Selecciona el empleado que la retira.'; end if;

    perform pg_advisory_xact_lock(hashtextextended(lower(empleado_limpio), 0));
    select count(*) into prestamos_activos
    from public.herramientas_comunes_herramientas
    where estado = 'prestada'
      and lower(btrim(empleado_actual)) = lower(empleado_limpio);

    if prestamos_activos >= 3 then
      raise exception '% ya tiene 3 herramientas retiradas. Debe devolver una antes de coger otra.', empleado_limpio;
    end if;

    update public.herramientas_comunes_herramientas
    set estado = 'prestada', empleado_actual = empleado_limpio,
        vehiculo_actual = vehiculo_limpio, retirada_at = now()
    where id = anterior.id returning * into actualizada;
    insert into public.herramientas_comunes_movimientos
      (herramienta_id, tipo, empleado, vehiculo, estado_anterior, estado_nuevo)
    values (anterior.id, 'retirada', empleado_limpio, vehiculo_limpio, anterior.estado, 'prestada');
  elsif p_accion = 'devolver' then
    if anterior.estado <> 'prestada' then raise exception 'La herramienta no figura como prestada.'; end if;
    empleado_limpio := coalesce(empleado_limpio, anterior.empleado_actual);
    if empleado_limpio is null then raise exception 'Selecciona el empleado que la coloca.'; end if;
    update public.herramientas_comunes_herramientas
    set estado = 'disponible', empleado_actual = null,
        vehiculo_actual = null, retirada_at = null
    where id = anterior.id returning * into actualizada;
    insert into public.herramientas_comunes_movimientos
      (herramienta_id, tipo, empleado, vehiculo, estado_anterior, estado_nuevo)
    values (anterior.id, 'devolucion', empleado_limpio, anterior.vehiculo_actual, anterior.estado, 'disponible');
  elsif p_accion = 'estado' then
    if p_estado_nuevo not in ('disponible', 'perdida') then raise exception 'Estado no válido.'; end if;
    update public.herramientas_comunes_herramientas
    set estado = p_estado_nuevo, empleado_actual = null,
        vehiculo_actual = null, retirada_at = null
    where id = anterior.id returning * into actualizada;
    insert into public.herramientas_comunes_movimientos
      (herramienta_id, tipo, empleado, vehiculo, estado_anterior, estado_nuevo)
    values (anterior.id, 'cambio_estado', empleado_limpio, anterior.vehiculo_actual, anterior.estado, p_estado_nuevo);
  else
    raise exception 'Acción no válida.';
  end if;

  return actualizada;
end;
$$;

revoke all on function public.herramientas_comunes_cambiar_estado(bigint, text, text, text, text) from public, anon, authenticated;
grant execute on function public.herramientas_comunes_cambiar_estado(bigint, text, text, text, text) to service_role;
