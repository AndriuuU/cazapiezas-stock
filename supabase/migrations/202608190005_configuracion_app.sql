-- Opciones modificables desde la web, protegidas por RLS.
create table if not exists public.cazapiezas_configuracion (
  clave text primary key,
  valor jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

insert into public.cazapiezas_configuracion (clave, valor)
values ('herramientas', '{
  "requireLocationScanOnReturn": true,
  "allowManualLocationCode": true,
  "askVehicleOnLoan": true,
  "requireVehicleOnLoan": false,
  "employeesCanMarkMissing": true,
  "requirePhotoOnCreate": false
}'::jsonb)
on conflict (clave) do nothing;

alter table public.cazapiezas_configuracion enable row level security;
alter table public.cazapiezas_configuracion force row level security;
revoke all on public.cazapiezas_configuracion from public, anon, authenticated;
grant select, insert, update on public.cazapiezas_configuracion to service_role;

notify pgrst, 'reload schema';
