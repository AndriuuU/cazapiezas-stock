-- Una publicación externa en Recambio Fácil no equivale a que la pieza esté
-- lista o publicada dentro del proceso físico de Almacén Desguace.
alter table public.almacen_desguace_piezas
  drop constraint if exists almacen_desguace_disponible_ubicado_check;

alter table public.almacen_desguace_piezas
  add constraint almacen_desguace_disponible_ubicado_check check (
    estado_proceso not in ('Lista para publicar', 'Publicada')
    or ubicacion is not null
  );

alter table public.almacen_desguace_piezas
  drop constraint if exists almacen_desguace_publicable_completo_check;

alter table public.almacen_desguace_piezas
  add constraint almacen_desguace_publicable_completo_check check (
    estado_proceso not in ('Lista para publicar', 'Publicada')
    or (
      nullif(btrim(nombre_pieza), '') is not null
      and (
        nullif(btrim(referencia_principal), '') is not null
        or nullif(btrim(referencia_oem), '') is not null
      )
      and estado_pieza is not null
      and precio_venta is not null
      and ubicacion is not null
      and cantidad is not null
    )
  );

update public.almacen_desguace_piezas
set publicado_online = true
where procedencia like 'CAT stockcat.csv%';

notify pgrst, 'reload schema';
