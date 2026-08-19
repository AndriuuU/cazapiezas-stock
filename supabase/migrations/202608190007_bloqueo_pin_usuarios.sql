-- Bloquea de forma permanente un usuario tras cuatro PIN incorrectos seguidos.
alter table public.cazapiezas_usuarios
  add column if not exists intentos_pin_fallidos integer not null default 0,
  add column if not exists bloqueado boolean not null default false,
  add column if not exists bloqueado_at timestamptz;

alter table public.cazapiezas_usuarios
  drop constraint if exists cazapiezas_usuarios_intentos_pin_check;

alter table public.cazapiezas_usuarios
  add constraint cazapiezas_usuarios_intentos_pin_check
  check (intentos_pin_fallidos between 0 and 4);

create or replace function public.cazapiezas_registrar_intento_pin(
  p_user_id uuid,
  p_correcto boolean
)
returns table (bloqueado boolean, intentos integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  usuario public.cazapiezas_usuarios%rowtype;
begin
  select * into usuario
  from public.cazapiezas_usuarios
  where id = p_user_id
  for update;

  if not found then
    return;
  end if;

  if usuario.bloqueado then
    return query select true, usuario.intentos_pin_fallidos;
    return;
  end if;

  if p_correcto then
    update public.cazapiezas_usuarios
    set intentos_pin_fallidos = 0
    where id = p_user_id;
    return query select false, 0;
  else
    update public.cazapiezas_usuarios
    set intentos_pin_fallidos = least(intentos_pin_fallidos + 1, 4),
        bloqueado = intentos_pin_fallidos + 1 >= 4,
        bloqueado_at = case when intentos_pin_fallidos + 1 >= 4 then now() else bloqueado_at end
    where id = p_user_id
    returning cazapiezas_usuarios.bloqueado, cazapiezas_usuarios.intentos_pin_fallidos
    into usuario.bloqueado, usuario.intentos_pin_fallidos;
    return query select usuario.bloqueado, usuario.intentos_pin_fallidos;
  end if;
end;
$$;

revoke all on function public.cazapiezas_registrar_intento_pin(uuid, boolean) from public, anon, authenticated;
grant execute on function public.cazapiezas_registrar_intento_pin(uuid, boolean) to service_role;

notify pgrst, 'reload schema';
