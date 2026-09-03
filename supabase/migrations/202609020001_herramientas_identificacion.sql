-- Control centralizado de etiquetas QR y pegatinas NFC de herramientas comunes.
alter table public.herramientas_comunes_herramientas
  add column if not exists qr_impresa_at timestamptz,
  add column if not exists qr_impresa_por text,
  add column if not exists nfc_grabada_at timestamptz,
  add column if not exists nfc_grabada_por text;

create index if not exists herramientas_comunes_identificacion_idx
  on public.herramientas_comunes_herramientas (qr_impresa_at, nfc_grabada_at)
  where archivada = false;
