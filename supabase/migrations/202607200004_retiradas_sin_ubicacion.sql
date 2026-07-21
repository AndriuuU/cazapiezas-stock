-- Las piezas retiradas dejan de ocupar un hueco y salen de cualquier cajón.

create or replace function public.almacen_desguace_normalizar_retirada()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.estado_proceso = 'Retirada' then
    new.ubicacion := null;
    new.cajon_id := null;
    new.publicado_online := false;
  end if;
  return new;
end;
$$;

drop trigger if exists almacen_desguace_normalizar_retirada
  on public.almacen_desguace_piezas;
create trigger almacen_desguace_normalizar_retirada
before insert or update of estado_proceso, ubicacion, cajon_id, publicado_online
on public.almacen_desguace_piezas
for each row execute function public.almacen_desguace_normalizar_retirada();

-- Corrige también las retiradas creadas antes de esta versión.
update public.almacen_desguace_piezas
set ubicacion = null,
    cajon_id = null,
    publicado_online = false
where estado_proceso = 'Retirada'
  and (ubicacion is not null or cajon_id is not null or publicado_online);

notify pgrst, 'reload schema';
