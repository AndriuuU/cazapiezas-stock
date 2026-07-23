import { NextResponse } from "next/server";
import { recordAuditEventsSafely } from "@/lib/almacen-desguace-auditoria";
import { protectApiRequest } from "@/lib/request-security";
import { getSupabaseApiConfig, parseSupabaseResponse, supabaseHeaders } from "@/lib/supabase-rest";

function normalizeIds(value: unknown) {
  return Array.isArray(value)
    ? [...new Set(value.map(Number).filter((id) => Number.isInteger(id) && id > 0))]
    : [];
}

export async function POST(request: Request) {
  const guard = await protectApiRequest(request, { keyPrefix: "desguace:rf-confirm-online", limit: 20, windowMs: 60_000 });
  if (guard) return guard;

  try {
    const body = await request.json() as { ids?: unknown };
    const ids = normalizeIds(body.ids);
    if (!ids.length) return NextResponse.json({ error: "Selecciona al menos una pieza." }, { status: 400 });
    if (ids.length > 1000) return NextResponse.json({ error: "Solo se pueden confirmar 1.000 piezas por operación." }, { status: 400 });

    const { url, key } = getSupabaseApiConfig();
    const selectedParams = new URLSearchParams({
      id: `in.(${ids.join(",")})`,
      select: "id,codigo_interno,nombre_pieza,cajon_id,publicado_online,referencia_principal,codigo_recambio_facil",
      limit: "1000",
    });
    const selectedResponse = await fetch(`${url}/rest/v1/almacen_desguace_piezas?${selectedParams}`, {
      headers: supabaseHeaders(key),
      cache: "no-store",
    });
    const selected = await parseSupabaseResponse<Array<{
      id: number;
      codigo_interno: string;
      nombre_pieza: string | null;
      cajon_id: number | null;
      publicado_online: boolean;
      referencia_principal: string | null;
      codigo_recambio_facil: string | null;
    }>>(selectedResponse);
    if (selected.length !== ids.length) {
      return NextResponse.json({ error: "Alguna pieza ya no existe. Actualiza el listado y vuelve a intentarlo." }, { status: 409 });
    }

    const response = await fetch(`${url}/rest/v1/rpc/almacen_desguace_confirmar_online_rf`, {
      method: "POST",
      headers: supabaseHeaders(key),
      body: JSON.stringify({ p_ids: ids }),
    });
    const updated = await parseSupabaseResponse<Array<{ id: number }>>(response);
    if (updated.length !== ids.length) {
      return NextResponse.json({ error: "Alguna pieza ya no existe. Actualiza el listado y vuelve a intentarlo." }, { status: 409 });
    }
    await recordAuditEventsSafely(selected.map((piece) => ({
      pieza_id: piece.id,
      pieza_codigo: piece.codigo_interno,
      pieza_nombre: piece.nombre_pieza,
      cajon_id: piece.cajon_id,
      tipo_evento: "online_manual",
      accion: piece.publicado_online ? "Online confirmado manualmente de nuevo" : "Marcada Online manualmente",
      campos_cambiados: piece.publicado_online ? [] : ["publicado_online"],
      valor_anterior: { publicado_online: piece.publicado_online },
      valor_nuevo: {
        publicado_online: true,
        codigo_recambio_facil: piece.codigo_recambio_facil || piece.referencia_principal,
      },
      detalle: "Confirmación manual desde la lista; guarda la referencia interna como código R/F y no realiza una publicación nueva.",
      origen: "confirmacion_manual",
      metadata: { codigo_rf: piece.codigo_recambio_facil || piece.referencia_principal },
    })));
    return NextResponse.json({ count: updated.length });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo confirmar el estado Online." }, { status: 500 });
  }
}
