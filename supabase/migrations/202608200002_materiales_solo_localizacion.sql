-- Materiales que se muestran y localizan, pero no se prestan individualmente.
alter table public.herramientas_comunes_herramientas
  add column if not exists solo_localizacion boolean not null default false,
  add column if not exists espacio_ocupado text;

alter table public.herramientas_comunes_herramientas
  drop constraint if exists herramientas_comunes_solo_localizacion_no_prestada_check;

alter table public.herramientas_comunes_herramientas
  add constraint herramientas_comunes_solo_localizacion_no_prestada_check check (
    not solo_localizacion or estado <> 'prestada'
  );

comment on column public.herramientas_comunes_herramientas.solo_localizacion is
  'Se muestra en búsquedas y plano, pero no se puede retirar ni prestar.';

comment on column public.herramientas_comunes_herramientas.espacio_ocupado is
  'Descripción visible del espacio que ocupa, por ejemplo caja azul o media balda.';

notify pgrst, 'reload schema';
