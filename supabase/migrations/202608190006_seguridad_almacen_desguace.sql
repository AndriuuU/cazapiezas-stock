-- Cierra el acceso directo al almacén de desguace.
-- La aplicación accede a estas tablas únicamente desde sus rutas de servidor,
-- donde se comprueba la sesión y el rol del usuario antes de cada operación.

do $$
declare
  tabla text;
  politica record;
begin
  foreach tabla in array array[
    'almacen_desguace_piezas',
    'almacen_desguace_fotos',
    'almacen_desguace_estanterias',
    'almacen_desguace_ubicaciones_movimientos',
    'almacen_desguace_plano_elementos',
    'almacen_desguace_eventos',
    'almacen_desguace_piezas_iam',
    'almacen_desguace_cajones',
    'almacen_desguace_cajones_movimientos'
  ]
  loop
    if to_regclass('public.' || tabla) is not null then
      -- Elimina cualquier política antigua permisiva, aunque hubiera cambiado
      -- de nombre respecto a las primeras migraciones.
      for politica in
        select policyname
        from pg_policies
        where schemaname = 'public' and tablename = tabla
      loop
        execute format('drop policy if exists %I on public.%I', politica.policyname, tabla);
      end loop;

      execute format('alter table public.%I enable row level security', tabla);
      execute format('alter table public.%I force row level security', tabla);
      execute format('revoke all on table public.%I from public, anon, authenticated', tabla);
      execute format('grant select, insert, update, delete on table public.%I to service_role', tabla);
    end if;
  end loop;
end
$$;

-- Las secuencias también estaban expuestas a las claves públicas antiguas.
do $$
declare
  secuencia record;
begin
  for secuencia in
    select c.relname
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind = 'S'
      and c.relname like 'almacen_desguace_%'
  loop
    execute format('revoke all on sequence public.%I from public, anon, authenticated', secuencia.relname);
    execute format('grant usage, select, update on sequence public.%I to service_role', secuencia.relname);
  end loop;
end
$$;

-- Impide ejecutar directamente las funciones que realizan cambios masivos.
do $$
declare
  funcion record;
begin
  for funcion in
    select p.proname, pg_get_function_identity_arguments(p.oid) as argumentos
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and (
        p.proname like 'almacen_desguace_%'
        or p.proname = 'importar_piezas_iam'
      )
  loop
    execute format(
      'revoke all on function public.%I(%s) from public, anon, authenticated',
      funcion.proname,
      funcion.argumentos
    );
    execute format(
      'grant execute on function public.%I(%s) to service_role',
      funcion.proname,
      funcion.argumentos
    );
  end loop;
end
$$;

-- Las fotos siguen siendo visibles mediante la URL pública del bucket, pero
-- ya no se pueden subir, modificar o borrar usando una clave pública.
drop policy if exists "API fotos almacen desguace" on storage.objects;

notify pgrst, 'reload schema';
