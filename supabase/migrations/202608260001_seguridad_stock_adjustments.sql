-- Cierra el acceso directo a los ajustes de stock sin modificar sus datos.
-- IMPORTANTE: desplegar antes la aplicación con SUPABASE_SERVICE_ROLE_KEY.

do $$
declare
  politica record;
  secuencia record;
begin
  if to_regclass('public.stock_adjustments') is null then
    raise notice 'La tabla public.stock_adjustments no existe; no se aplica ningún cambio.';
    return;
  end if;

  -- Retira cualquier política permisiva previa, independientemente de su nombre.
  for politica in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'stock_adjustments'
  loop
    execute format(
      'drop policy if exists %I on public.stock_adjustments',
      politica.policyname
    );
  end loop;

  alter table public.stock_adjustments enable row level security;
  alter table public.stock_adjustments force row level security;

  revoke all on table public.stock_adjustments from public, anon, authenticated;
  grant select, insert, update on table public.stock_adjustments to service_role;

  -- Protege también las secuencias identity/serial pertenecientes a la tabla.
  for secuencia in
    select distinct secuencia_clase.relname
    from pg_class secuencia_clase
    join pg_namespace secuencia_esquema
      on secuencia_esquema.oid = secuencia_clase.relnamespace
    join pg_depend dependencia
      on dependencia.objid = secuencia_clase.oid
      and dependencia.deptype in ('a', 'i')
    join pg_class tabla
      on tabla.oid = dependencia.refobjid
    join pg_namespace tabla_esquema
      on tabla_esquema.oid = tabla.relnamespace
    where secuencia_clase.relkind = 'S'
      and secuencia_esquema.nspname = 'public'
      and tabla_esquema.nspname = 'public'
      and tabla.relname = 'stock_adjustments'
  loop
    execute format(
      'revoke all on sequence public.%I from public, anon, authenticated',
      secuencia.relname
    );
    execute format(
      'grant usage, select, update on sequence public.%I to service_role',
      secuencia.relname
    );
  end loop;
end
$$;

notify pgrst, 'reload schema';
