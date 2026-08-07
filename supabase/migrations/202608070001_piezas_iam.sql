-- Piezas IAM dentro del mismo almacén, conservando sus campos específicos.
alter table public.almacen_desguace_piezas
  add column if not exists tipo_pieza text not null default 'CAT';

alter table public.almacen_desguace_piezas
  drop constraint if exists almacen_desguace_tipo_pieza_check;
alter table public.almacen_desguace_piezas
  add constraint almacen_desguace_tipo_pieza_check check (tipo_pieza in ('CAT', 'IAM'));

create index if not exists almacen_desguace_tipo_pieza_idx
  on public.almacen_desguace_piezas (tipo_pieza);

create table if not exists public.almacen_desguace_piezas_iam (
  pieza_id bigint primary key references public.almacen_desguace_piezas(id) on delete cascade,
  codigo_iam bigint,
  idcliente bigint,
  referencia_2 text,
  referencia_3 text,
  marca_rf text,
  id_marca bigint,
  familia text,
  precio_base numeric(12, 2),
  precio_ecotasa numeric(12, 2),
  precio_publicado numeric(12, 2),
  importe_casco numeric(12, 2),
  precio_pvp numeric(12, 2),
  precio_pue numeric(12, 2),
  precio_pm numeric(12, 2),
  fecha_base date,
  fecha_insercion date,
  fecha_ultima_entrada date,
  fecha_ultima_salida date,
  fecha_ultimo_movimiento date,
  forma_publicacion text,
  almacen_origen text,
  ubicacion_estanteria_origen text,
  peso numeric(12, 3),
  largo numeric(12, 3),
  ancho numeric(12, 3),
  alto numeric(12, 3),
  clave_importacion text unique,
  datos_origen jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint almacen_desguace_iam_precios_check check (
    (precio_base is null or precio_base >= 0) and
    (precio_ecotasa is null or precio_ecotasa >= 0) and
    (precio_publicado is null or precio_publicado >= 0) and
    (importe_casco is null or importe_casco >= 0) and
    (precio_pvp is null or precio_pvp >= 0) and
    (precio_pue is null or precio_pue >= 0) and
    (precio_pm is null or precio_pm >= 0)
  )
);

create unique index if not exists almacen_desguace_iam_cliente_codigo_idx
  on public.almacen_desguace_piezas_iam (idcliente, codigo_iam)
  where idcliente is not null and codigo_iam is not null;
create index if not exists almacen_desguace_iam_referencia2_idx
  on public.almacen_desguace_piezas_iam (referencia_2);
create index if not exists almacen_desguace_iam_referencia3_idx
  on public.almacen_desguace_piezas_iam (referencia_3);

drop trigger if exists almacen_desguace_iam_updated_at on public.almacen_desguace_piezas_iam;
create trigger almacen_desguace_iam_updated_at
before update on public.almacen_desguace_piezas_iam
for each row execute function public.almacen_desguace_set_updated_at();

alter table public.almacen_desguace_piezas_iam enable row level security;
drop policy if exists "API desguace piezas IAM" on public.almacen_desguace_piezas_iam;
create policy "API desguace piezas IAM" on public.almacen_desguace_piezas_iam
  for all to anon, authenticated using (true) with check (true);
grant select, insert, update, delete on public.almacen_desguace_piezas_iam to anon, authenticated;

create or replace function public.importar_piezas_iam(p_registros jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  registro jsonb;
  base jsonb;
  detalle jsonb;
  pieza bigint;
  insertadas integer := 0;
  actualizadas integer := 0;
  ids jsonb := '[]'::jsonb;
begin
  if jsonb_typeof(p_registros) <> 'array' then
    raise exception 'Los registros IAM deben enviarse como una lista';
  end if;

  for registro in select value from jsonb_array_elements(p_registros)
  loop
    base := registro -> 'base';
    detalle := registro -> 'iam';
    pieza := null;

    select i.pieza_id into pieza
    from public.almacen_desguace_piezas_iam i
    where (nullif(detalle ->> 'clave_importacion', '') is not null and i.clave_importacion = detalle ->> 'clave_importacion')
       or (
         nullif(detalle ->> 'idcliente', '') is not null
         and nullif(detalle ->> 'codigo_iam', '') is not null
         and i.idcliente = (detalle ->> 'idcliente')::bigint
         and i.codigo_iam = (detalle ->> 'codigo_iam')::bigint
       )
    order by case when i.clave_importacion = detalle ->> 'clave_importacion' then 0 else 1 end
    limit 1;

    if pieza is null then
      insert into public.almacen_desguace_piezas (
        tipo_pieza, nombre_pieza, descripcion, categoria, marca_pieza,
        referencia_principal, referencia_oem, referencias_equivalentes,
        estado_pieza, cantidad, precio_venta, procedencia, estado_proceso,
        publicado_online, fecha_entrada
      ) values (
        'IAM', nullif(base ->> 'nombre_pieza', ''), nullif(base ->> 'descripcion', ''),
        nullif(base ->> 'categoria', ''), nullif(base ->> 'marca_pieza', ''),
        nullif(base ->> 'referencia_principal', ''), nullif(base ->> 'referencia_oem', ''),
        nullif(base ->> 'referencias_equivalentes', ''),
        coalesce(nullif(base ->> 'estado_pieza', ''), 'Nueva'),
        nullif(base ->> 'cantidad', '')::integer,
        nullif(base ->> 'precio_venta', '')::numeric,
        nullif(base ->> 'procedencia', ''),
        'Pendiente de identificar', false,
        coalesce(nullif(base ->> 'fecha_entrada', '')::date, current_date)
      ) returning id into pieza;
      insertadas := insertadas + 1;
    else
      update public.almacen_desguace_piezas set
        tipo_pieza = 'IAM',
        nombre_pieza = coalesce(nullif(base ->> 'nombre_pieza', ''), nombre_pieza),
        categoria = coalesce(nullif(base ->> 'categoria', ''), categoria),
        marca_pieza = coalesce(nullif(base ->> 'marca_pieza', ''), marca_pieza),
        referencia_principal = coalesce(nullif(base ->> 'referencia_principal', ''), referencia_principal),
        referencia_oem = coalesce(nullif(base ->> 'referencia_oem', ''), referencia_oem),
        referencias_equivalentes = coalesce(nullif(base ->> 'referencias_equivalentes', ''), referencias_equivalentes),
        cantidad = coalesce(nullif(base ->> 'cantidad', '')::integer, cantidad),
        precio_venta = coalesce(nullif(base ->> 'precio_venta', '')::numeric, precio_venta)
      where id = pieza;
      actualizadas := actualizadas + 1;
    end if;

    insert into public.almacen_desguace_piezas_iam (
      pieza_id, codigo_iam, idcliente, referencia_2, referencia_3, marca_rf, id_marca,
      familia, precio_base, precio_ecotasa, precio_publicado, importe_casco,
      precio_pvp, precio_pue, precio_pm, fecha_base, fecha_insercion,
      fecha_ultima_entrada, fecha_ultima_salida, fecha_ultimo_movimiento,
      forma_publicacion, almacen_origen, ubicacion_estanteria_origen,
      peso, largo, ancho, alto, clave_importacion, datos_origen
    ) values (
      pieza, nullif(detalle ->> 'codigo_iam', '')::bigint, nullif(detalle ->> 'idcliente', '')::bigint,
      nullif(detalle ->> 'referencia_2', ''), nullif(detalle ->> 'referencia_3', ''),
      nullif(detalle ->> 'marca_rf', ''), nullif(detalle ->> 'id_marca', '')::bigint,
      nullif(detalle ->> 'familia', ''), nullif(detalle ->> 'precio_base', '')::numeric,
      nullif(detalle ->> 'precio_ecotasa', '')::numeric, nullif(detalle ->> 'precio_publicado', '')::numeric,
      nullif(detalle ->> 'importe_casco', '')::numeric, nullif(detalle ->> 'precio_pvp', '')::numeric,
      nullif(detalle ->> 'precio_pue', '')::numeric, nullif(detalle ->> 'precio_pm', '')::numeric,
      nullif(detalle ->> 'fecha_base', '')::date, nullif(detalle ->> 'fecha_insercion', '')::date,
      nullif(detalle ->> 'fecha_ultima_entrada', '')::date, nullif(detalle ->> 'fecha_ultima_salida', '')::date,
      nullif(detalle ->> 'fecha_ultimo_movimiento', '')::date, nullif(detalle ->> 'forma_publicacion', ''),
      nullif(detalle ->> 'almacen_origen', ''), nullif(detalle ->> 'ubicacion_estanteria_origen', ''),
      nullif(detalle ->> 'peso', '')::numeric, nullif(detalle ->> 'largo', '')::numeric,
      nullif(detalle ->> 'ancho', '')::numeric, nullif(detalle ->> 'alto', '')::numeric,
      nullif(detalle ->> 'clave_importacion', ''), coalesce(detalle -> 'datos_origen', '{}'::jsonb)
    ) on conflict (pieza_id) do update set
      codigo_iam = excluded.codigo_iam, idcliente = excluded.idcliente,
      referencia_2 = excluded.referencia_2, referencia_3 = excluded.referencia_3,
      marca_rf = excluded.marca_rf, id_marca = excluded.id_marca, familia = excluded.familia,
      precio_base = excluded.precio_base, precio_ecotasa = excluded.precio_ecotasa,
      precio_publicado = excluded.precio_publicado, importe_casco = excluded.importe_casco,
      precio_pvp = excluded.precio_pvp, precio_pue = excluded.precio_pue, precio_pm = excluded.precio_pm,
      fecha_base = excluded.fecha_base, fecha_insercion = excluded.fecha_insercion,
      fecha_ultima_entrada = excluded.fecha_ultima_entrada, fecha_ultima_salida = excluded.fecha_ultima_salida,
      fecha_ultimo_movimiento = excluded.fecha_ultimo_movimiento,
      forma_publicacion = excluded.forma_publicacion, almacen_origen = excluded.almacen_origen,
      ubicacion_estanteria_origen = excluded.ubicacion_estanteria_origen,
      peso = excluded.peso, largo = excluded.largo, ancho = excluded.ancho, alto = excluded.alto,
      clave_importacion = excluded.clave_importacion, datos_origen = excluded.datos_origen;

    ids := ids || jsonb_build_array(pieza);
  end loop;
  return jsonb_build_object('insertadas', insertadas, 'actualizadas', actualizadas, 'ids', ids);
end;
$$;

grant execute on function public.importar_piezas_iam(jsonb) to anon, authenticated;
