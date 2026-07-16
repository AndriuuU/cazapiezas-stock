import { NextResponse } from "next/server";
import { getShelves, suggestLocations } from "@/lib/almacen-desguace-estanterias";
import { protectApiRequest } from "@/lib/request-security";
import type { PiezaDesguace } from "@/types/almacen-desguace";

type SuggestionInput = Partial<Pick<PiezaDesguace, "categoria" | "nombre_pieza" | "descripcion" | "marca_pieza" | "marca_vehiculo" | "modelo_vehiculo">>;

export async function POST(request: Request) {
  const guard = await protectApiRequest(request, { keyPrefix: "desguace:location-form", limit: 100, windowMs: 60_000 });
  if (guard) return guard;
  try {
    const body = await request.json() as SuggestionInput;
    const shelves = await getShelves();
    const suggestions = suggestLocations(body, shelves);
    return NextResponse.json({
      suggestion: suggestions[0] || null,
      alternatives: suggestions.slice(1, 5),
      availableShelves: shelves.filter((shelf) => shelf.activa && !shelf.llena && shelf.siguiente_ubicacion),
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudieron calcular ubicaciones." }, { status: 500 });
  }
}
