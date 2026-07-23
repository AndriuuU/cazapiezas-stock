import "server-only";

import { getSupabaseApiConfig, parseSupabaseResponse, supabaseHeaders } from "@/lib/supabase-rest";
import type { EventoAlmacen, TipoEventoAlmacen } from "@/types/almacen-desguace";

type AuditEventInput = {
  pieza_id?: number | null;
  pieza_codigo: string;
  pieza_nombre?: string | null;
  cajon_id?: number | null;
  tipo_evento: TipoEventoAlmacen;
  accion: string;
  campos_cambiados?: string[];
  valor_anterior?: Record<string, unknown> | null;
  valor_nuevo?: Record<string, unknown> | null;
  exito?: boolean;
  detalle?: string | null;
  error?: string | null;
  origen?: string;
  usuario_nombre?: string;
  metadata?: Record<string, unknown>;
};

export async function getAuditHistory(options: { pieceId?: string | number; limit?: number } = {}) {
  const { url, key } = getSupabaseApiConfig();
  const params = new URLSearchParams({
    select: "*",
    order: "created_at.desc",
    limit: String(Math.min(2000, Math.max(1, options.limit || 500))),
  });
  if (options.pieceId !== undefined) params.set("pieza_id", `eq.${options.pieceId}`);

  const response = await fetch(`${url}/rest/v1/almacen_desguace_eventos?${params}`, {
    headers: supabaseHeaders(key),
    cache: "no-store",
  });
  return parseSupabaseResponse<EventoAlmacen[]>(response);
}

export async function recordAuditEvents(events: AuditEventInput[]) {
  if (!events.length) return;
  const { url, key } = getSupabaseApiConfig();
  const response = await fetch(`${url}/rest/v1/almacen_desguace_eventos`, {
    method: "POST",
    headers: supabaseHeaders(key, { Prefer: "return=minimal" }),
    body: JSON.stringify(events.map((event) => ({
      pieza_id: event.pieza_id ?? null,
      pieza_codigo: event.pieza_codigo,
      pieza_nombre: event.pieza_nombre ?? null,
      cajon_id: event.cajon_id ?? null,
      tipo_evento: event.tipo_evento,
      accion: event.accion,
      campos_cambiados: event.campos_cambiados ?? [],
      valor_anterior: event.valor_anterior ?? null,
      valor_nuevo: event.valor_nuevo ?? null,
      exito: event.exito ?? true,
      detalle: event.detalle ?? null,
      error: event.error ?? null,
      origen: event.origen ?? "app",
      usuario_nombre: event.usuario_nombre ?? "Usuario de almacén",
      metadata: event.metadata ?? {},
    }))),
  });
  if (!response.ok) throw new Error((await response.text()).slice(0, 500));
}

export async function recordAuditEventsSafely(events: AuditEventInput[]) {
  try {
    await recordAuditEvents(events);
  } catch (error) {
    console.error("No se pudo guardar la auditoría del Almacén Desguace:", error);
  }
}
