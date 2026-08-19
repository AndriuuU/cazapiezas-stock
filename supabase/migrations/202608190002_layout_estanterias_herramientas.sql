-- Plano configurable de las seis estanterías de herramientas.
alter table public.herramientas_comunes_estanterias
  add column if not exists configuracion jsonb not null default '{"filas": []}'::jsonb;

insert into public.herramientas_comunes_estanterias (codigo, nombre, zona, niveles, orden, configuracion)
values ('T04', 'Estantería 4', 'Taller', 5, 4, '{"filas": []}'::jsonb)
on conflict (codigo) do nothing;

update public.herramientas_comunes_estanterias set nombre = 'Estantería 5', zona = 'AUX', orden = 5 where codigo = 'A01';
update public.herramientas_comunes_estanterias set nombre = 'Estantería 6', zona = 'AUX', orden = 6 where codigo = 'A02';

update public.herramientas_comunes_estanterias set niveles = 3, configuracion = '{
  "filas": [
    {"nivel":3,"nombre":"Nivel superior","tipo":"balda","columnas":1,"altura":1},
    {"nivel":2,"nombre":"Zona para colgar","tipo":"colgador","columnas":1,"altura":3},
    {"nivel":1,"nombre":"Nivel inferior","tipo":"balda","columnas":1,"altura":1}
  ]}'::jsonb where codigo = 'T01' and configuracion = '{"filas": []}'::jsonb;

update public.herramientas_comunes_estanterias set niveles = 5, configuracion = '{
  "filas": [
    {"nivel":5,"nombre":"Nivel 5","tipo":"balda","columnas":1,"altura":1},
    {"nivel":4,"nombre":"Nivel 4","tipo":"balda","columnas":1,"altura":2},
    {"nivel":3,"nombre":"Nivel 3","tipo":"balda","columnas":1,"altura":2},
    {"nivel":2,"nombre":"Nivel 2","tipo":"balda","columnas":1,"altura":1},
    {"nivel":1,"nombre":"Nivel 1","tipo":"balda","columnas":1,"altura":2}
  ]}'::jsonb where codigo = 'T02' and configuracion = '{"filas": []}'::jsonb;

update public.herramientas_comunes_estanterias set niveles = 5, configuracion = '{
  "filas": [
    {"nivel":5,"nombre":"Nivel 5","tipo":"balda","columnas":1,"altura":1},
    {"nivel":4,"nombre":"Nivel 4","tipo":"balda","columnas":1,"altura":1},
    {"nivel":3,"nombre":"Nivel 3","tipo":"balda","columnas":1,"altura":2},
    {"nivel":2,"nombre":"Nivel 2","tipo":"balda","columnas":1,"altura":2},
    {"nivel":1,"nombre":"Nivel 1","tipo":"balda","columnas":1,"altura":1}
  ]}'::jsonb where codigo = 'T03' and configuracion = '{"filas": []}'::jsonb;

update public.herramientas_comunes_estanterias set niveles = 5, configuracion = '{
  "filas": [
    {"nivel":5,"nombre":"Nivel 5","tipo":"balda","columnas":1,"altura":1},
    {"nivel":4,"nombre":"Nivel 4","tipo":"balda","columnas":1,"altura":1},
    {"nivel":3,"nombre":"Nivel 3","tipo":"balda","columnas":1,"altura":1},
    {"nivel":2,"nombre":"Nivel 2","tipo":"balda","columnas":1,"altura":1},
    {"nivel":1,"nombre":"Nivel 1","tipo":"balda","columnas":1,"altura":1}
  ]}'::jsonb where codigo = 'T04' and configuracion = '{"filas": []}'::jsonb;

update public.herramientas_comunes_estanterias set niveles = 3, configuracion = '{
  "filas": [
    {"nivel":3,"nombre":"Superior","tipo":"balda","columnas":6,"altura":1},
    {"nivel":2,"nombre":"Intermedio","tipo":"balda","columnas":6,"altura":1},
    {"nivel":1,"nombre":"Inferior","tipo":"balda","columnas":1,"altura":3}
  ]}'::jsonb where codigo = 'A01' and configuracion = '{"filas": []}'::jsonb;

update public.herramientas_comunes_estanterias set niveles = 8, configuracion = '{
  "filas": [
    {"nivel":8,"nombre":"Superior","tipo":"balda","columnas":6,"altura":1},
    {"nivel":7,"nombre":"Intermedio","tipo":"balda","columnas":6,"altura":1},
    {"nivel":6,"nombre":"Nivel 6","tipo":"balda","columnas":1,"altura":1},
    {"nivel":5,"nombre":"Nivel 5","tipo":"balda","columnas":1,"altura":1},
    {"nivel":4,"nombre":"Nivel 4","tipo":"balda","columnas":1,"altura":1},
    {"nivel":3,"nombre":"Nivel 3","tipo":"balda","columnas":1,"altura":1},
    {"nivel":2,"nombre":"Nivel 2","tipo":"balda","columnas":1,"altura":1},
    {"nivel":1,"nombre":"Nivel 1","tipo":"balda","columnas":1,"altura":1}
  ]}'::jsonb where codigo = 'A02' and configuracion = '{"filas": []}'::jsonb;

notify pgrst, 'reload schema';
