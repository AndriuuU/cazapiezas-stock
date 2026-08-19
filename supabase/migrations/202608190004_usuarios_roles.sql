-- Usuarios globales de Cazapiezas con PIN cifrado y roles.
create table if not exists public.cazapiezas_usuarios (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  pin_hash text not null,
  rol text not null default 'empleado' check (rol in ('administrador', 'empleado')),
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists cazapiezas_usuarios_nombre_uidx
  on public.cazapiezas_usuarios (lower(btrim(nombre)));

drop trigger if exists cazapiezas_usuarios_updated_at on public.cazapiezas_usuarios;
create trigger cazapiezas_usuarios_updated_at before update on public.cazapiezas_usuarios
for each row execute function public.herramientas_comunes_set_updated_at();

alter table public.cazapiezas_usuarios enable row level security;
alter table public.cazapiezas_usuarios force row level security;
revoke all on public.cazapiezas_usuarios from public, anon, authenticated;
grant select, insert, update, delete on public.cazapiezas_usuarios to service_role;

notify pgrst, 'reload schema';
