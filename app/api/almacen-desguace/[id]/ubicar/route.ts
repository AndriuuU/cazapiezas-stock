import { NextResponse } from "next/server";
import { getPieza } from "@/lib/almacen-desguace-data";
import { getLocationParts, getShelfCode, getShelves, suggestLocations } from "@/lib/almacen-desguace-estanterias";
import { UBICACION_PATTERN } from "@/lib/almacen-desguace";
import { protectApiRequest } from "@/lib/request-security";
import { getSupabaseApiConfig, parseSupabaseResponse, supabaseHeaders } from "@/lib/supabase-rest";
import type { PiezaDesguace } from "@/types/almacen-desguace";

type Context = { params: Promise<{ id: string }> };
type PlacementResult = "colocada_sugerida" | "colocada_alternativa" | "no_colocada";

export async function GET(request: Request, context: Context) {
  const guard = await protectApiRequest(request, { keyPrefix: "desguace:placement-suggest", limit: 100, windowMs: 60_000 });
  if (guard) return guard;
  try {
    const { id } = await context.params;
    const [piece, shelves] = await Promise.all([getPieza(id), getShelves()]);
    if (!piece) return NextResponse.json({ error: "Pieza no encontrada." }, { status: 404 });
    const suggestions = suggestLocations(piece, shelves);
    return NextResponse.json({ piece, suggestion: suggestions[0] || null, alternatives: suggestions.slice(1, 4), shelves });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo calcular una ubicación." }, { status: 500 });
  }
}

export async function POST(request: Request, context: Context) {
  const guard = await protectApiRequest(request, { keyPrefix: "desguace:placement-confirm", limit: 60, windowMs: 60_000 });
  if (guard) return guard;
  try {
    const { id } = await context.params;
    const body = await request.json() as {
      resultado?: PlacementResult;
      ubicacion_sugerida?: string;
      ubicacion_final?: string;
      motivo?: string;
    };
    const result = body.resultado;
    if (!result || !["colocada_sugerida", "colocada_alternativa", "no_colocada"].includes(result)) {
      return NextResponse.json({ error: "Indica el resultado de la colocación." }, { status: 400 });
    }
    const [piece, shelves] = await Promise.all([getPieza(id), getShelves()]);
    if (!piece) return NextResponse.json({ error: "Pieza no encontrada." }, { status: 404 });
    const suggestions = suggestLocations(piece, shelves);
    const suggested = suggestions.find((item) => item.ubicacion === body.ubicacion_sugerida) || null;
    if (result === "colocada_sugerida" && !suggested) {
      return NextResponse.json({ error: "La sugerencia ha cambiado o la estantería se ha llenado. Solicita una nueva ubicación." }, { status: 409 });
    }
    if (result === "no_colocada" && !String(body.motivo || "").trim()) {
      return NextResponse.json({ error: "Indica por qué no se ha podido colocar." }, { status: 400 });
    }

    const finalLocation = result === "colocada_sugerida"
      ? body.ubicacion_sugerida?.toUpperCase()
      : result === "colocada_alternativa" ? body.ubicacion_final?.trim().toUpperCase() : null;
    let destinationShelf = null;
    if (result !== "no_colocada") {
      if (!finalLocation || !UBICACION_PATTERN.test(finalLocation)) {
        return NextResponse.json({ error: "La ubicación final debe tener el formato DESGUACE-E01-N03-C05." }, { status: 400 });
      }
      const shelfCode = getShelfCode(finalLocation);
      destinationShelf = shelves.find((shelf) => shelf.codigo === shelfCode) || null;
      if (!destinationShelf) return NextResponse.json({ error: `La estantería ${shelfCode || "indicada"} no está configurada.` }, { status: 400 });
      const locationParts = getLocationParts(finalLocation);
      if (!locationParts || locationParts.level > destinationShelf.niveles || locationParts.slot > destinationShelf.huecos_por_nivel) {
        return NextResponse.json({ error: `${finalLocation} queda fuera de los niveles o huecos configurados para ${destinationShelf.codigo}.` }, { status: 400 });
      }
      if (!destinationShelf.activa || (destinationShelf.llena && piece.ubicacion !== finalLocation)) {
        return NextResponse.json({ error: `La estantería ${destinationShelf.codigo} está ${destinationShelf.activa ? "llena" : "inactiva"}.` }, { status: 409 });
      }
    }

    const { url, key } = getSupabaseApiConfig();
    if (finalLocation && finalLocation !== piece.ubicacion) {
      const occupiedParams = new URLSearchParams({ select: "id,codigo_interno", ubicacion: `eq.${finalLocation}`, id: `neq.${id}`, limit: "1" });
      const occupiedResponse = await fetch(`${url}/rest/v1/almacen_desguace_piezas?${occupiedParams}`, { headers: supabaseHeaders(key), cache: "no-store" });
      const occupied = await parseSupabaseResponse<Array<{ id: number; codigo_interno: string }>>(occupiedResponse);
      if (occupied.length) return NextResponse.json({ error: `${finalLocation} ya está ocupado por ${occupied[0].codigo_interno}.` }, { status: 409 });
    }

    let updatedPiece = piece;
    if (finalLocation) {
      const updateParams = new URLSearchParams({ id: `eq.${id}`, select: "*" });
      const updateResponse = await fetch(`${url}/rest/v1/almacen_desguace_piezas?${updateParams}`, {
        method: "PATCH", headers: supabaseHeaders(key, { Prefer: "return=representation" }), body: JSON.stringify({ ubicacion: finalLocation }),
      });
      const updated = await parseSupabaseResponse<PiezaDesguace[]>(updateResponse);
      updatedPiece = updated[0];
    }
    if (result === "no_colocada") {
      const movementResponse = await fetch(`${url}/rest/v1/almacen_desguace_ubicaciones_movimientos`, {
        method: "POST", headers: supabaseHeaders(key, { Prefer: "return=minimal" }),
        body: JSON.stringify({
          pieza_id: Number(id),
          estanteria_sugerida_id: suggested?.estanteria.id || null,
          ubicacion_anterior: piece.ubicacion,
          ubicacion_sugerida: body.ubicacion_sugerida || null,
          resultado: result,
          ubicacion_final: null,
          tipo_movimiento: "incidencia",
          motivo: String(body.motivo || "").trim(),
          usuario_nombre: "Usuario de almacén",
          origen: "asistente de ubicación",
        }),
      });
      if (!movementResponse.ok) throw new Error("No se pudo registrar la incidencia de colocación.");
    }
    return NextResponse.json({ piece: updatedPiece, shelf: destinationShelf });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo confirmar la colocación." }, { status: 500 });
  }
}
