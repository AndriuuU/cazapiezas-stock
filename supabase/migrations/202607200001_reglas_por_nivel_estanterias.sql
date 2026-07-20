alter table public.almacen_desguace_estanterias
  add column if not exists reglas_nivel jsonb not null default '[]'::jsonb;

alter table public.almacen_desguace_estanterias
  drop constraint if exists almacen_desguace_estanterias_reglas_nivel_check;

alter table public.almacen_desguace_estanterias
  add constraint almacen_desguace_estanterias_reglas_nivel_check
  check (jsonb_typeof(reglas_nivel) = 'array');

comment on column public.almacen_desguace_estanterias.reglas_nivel is
  'Grupos de niveles y reglas de piezas: nivel_desde, nivel_hasta, contenido, categorias y palabras_clave.';

notify pgrst, 'reload schema';
