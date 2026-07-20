import { NextResponse } from "next/server";
import { requiresPublishValidation, UBICACION_PATTERN } from "@/lib/almacen-desguace";
import { getPieza } from "@/lib/almacen-desguace-data";
import { protectApiRequest } from "@/lib/request-security";
import { getSupabaseApiConfig, parseSupabaseResponse, supabaseHeaders } from "@/lib/supabase-rest";
import type { PiezaDesguace } from "@/types/almacen-desguace";

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: Context) {
  const guard = await protectApiRequest(request, { keyPrefix: "desguace:drawer-pieces", limit: 100, windowMs: 60_000 });
  if (guard) return guard;
  try {
    const { id } = await context.params;
    const body = await request.json() as { action?: string; pieza_id?: number; ubicacion_destino?: string };
    const piece = await getPieza(Number(body.pieza_id));
    if (!piece) return NextResponse.json({ error: "Pieza no encontrada." }, { status: 404 });
    let patch: Record<string, unknown>;
    if (body.action === "add") patch = { cajon_id: Number(id) };
    else if (body.action === "remove") {
      if (piece.cajon_id !== Number(id)) return NextResponse.json({ error: "La pieza no pertenece a este cajón." }, { status: 409 });
      const destination = String(body.ubicacion_destino || "").trim().toUpperCase() || null;
      if (destination && !UBICACION_PATTERN.test(destination)) return NextResponse.json({ error: "La nueva ubicación no tiene un formato válido." }, { status: 400 });
      if (!destination && requiresPublishValidation(piece.estado_proceso)) return NextResponse.json({ error: "Esta pieza está publicada: indica otra ubicación antes de retirarla del cajón." }, { status: 400 });
      patch = { cajon_id: null, ubicacion: destination };
    } else return NextResponse.json({ error: "Acción no válida." }, { status: 400 });

    const { url, key } = getSupabaseApiConfig();
    const params = new URLSearchParams({ id: `eq.${piece.id}`, select: "*" });
    const response = await fetch(`${url}/rest/v1/almacen_desguace_piezas?${params}`, {
      method: "PATCH", headers: supabaseHeaders(key, { Prefer: "return=representation" }), body: JSON.stringify(patch),
    });
    const rows = await parseSupabaseResponse<PiezaDesguace[]>(response);
    return NextResponse.json(rows[0]);
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo actualizar el contenido del cajón." }, { status: 500 }); }
}
