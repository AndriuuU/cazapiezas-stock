-- Permite registrar una herramienta antes de conocer su ubicación definitiva.
alter table public.herramientas_comunes_herramientas
  alter column estanteria_id drop not null,
  alter column nivel drop not null,
  alter column posicion drop not null;

alter table public.herramientas_comunes_herramientas
  drop constraint if exists herramientas_comunes_ubicacion_completa_check;

alter table public.herramientas_comunes_herramientas
  add constraint herramientas_comunes_ubicacion_completa_check check (
    (estanteria_id is null and nivel is null and posicion is null)
    or
    (estanteria_id is not null and nivel is not null and nullif(btrim(posicion), '') is not null)
  );

notify pgrst, 'reload schema';