-- "Publicada" y "Lista para publicar" son estados internos del flujo.
-- No ejecutan una publicación en Recambio Fácil ni requieren ubicación física.
-- La validación de los campos obligatorios se realiza únicamente en el endpoint
-- que envía expresamente las piezas a Recambio Fácil.

alter table public.almacen_desguace_piezas
  drop constraint if exists almacen_desguace_disponible_ubicado_check;

alter table public.almacen_desguace_piezas
  drop constraint if exists almacen_desguace_publicable_completo_check;

notify pgrst, 'reload schema';
