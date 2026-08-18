import { NextResponse } from "next/server";
import { getAuditHistory, recordAuditEvents } from "@/lib/almacen-desguace-auditoria";
import { protectApiRequest } from "@/lib/request-security";
import { getSupabaseApiConfig, parseSupabaseResponse, supabaseHeaders } from "@/lib/supabase-rest";
import type { PiezaDesguace } from "@/types/almacen-desguace";

type Context = { params: Promise<{ eventId: string }> };

export async function POST(request: Request, context: Context) {
  const guard = await protectApiRequest(request, { keyPrefix: "desguace:trash-restore", limit: 15, windowMs: 60_000 });
  if (guard) return guard;
  try {
    const { eventId } = await context.params;
    const event = (await getAuditHistory({ limit: 2000 })).find((item) => String(item.id) === eventId && item.tipo_evento === "eliminacion_pieza");
    if (!event?.valor_anterior) return NextResponse.json({ error: "No se encontró una copia recuperable de la pieza." }, { status: 404 });
    const snapshot = { ...event.valor_anterior } as Record<string, unknown>;
    delete snapshot.created_at;
    delete snapshot.updated_at;
    const { url, key } = getSupabaseApiConfig();
    const existsParams = new URLSearchParams({ select: "id", codigo_interno: `eq.${event.pieza_codigo}`, limit: "1" });
    const existsResponse = await fetch(`${url}/rest/v1/almacen_desguace_piezas?${existsParams}`, { headers: supabaseHeaders(key), cache: "no-store" });
    const existing = await parseSupabaseResponse<Array<{ id: number }>>(existsResponse);
    if (existing.length) return NextResponse.json({ error: "La pieza ya está recuperada o existe otra con el mismo código." }, { status: 409 });
    const response = await fetch(`${url}/rest/v1/almacen_desguace_piezas?select=*`, { method: "POST", headers: supabaseHeaders(key, { Prefer: "return=representation" }), body: JSON.stringify(snapshot) });
    const restored = (await parseSupabaseResponse<PiezaDesguace[]>(response))[0];
    await recordAuditEvents([{ pieza_id: restored.id, pieza_codigo: restored.codigo_interno, pieza_nombre: restored.nombre_pieza, tipo_evento: "edicion_pieza", accion: "Pieza recuperada de la papelera", valor_nuevo: snapshot, detalle: "Se recuperó la pieza desde la instantánea guardada antes de eliminarla.", origen: "papelera", metadata: { operacion: "papelera_restaurada", eliminacion_evento_id: event.id } }]);
    return NextResponse.json({ piece: restored, message: `${restored.codigo_interno} recuperada correctamente.` });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo recuperar la pieza." }, { status: 500 });
  }
}
