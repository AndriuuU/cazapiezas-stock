import { NextResponse } from "next/server";
import { getWarehousePlan } from "@/lib/almacen-desguace-estanterias";
import { protectApiRequest } from "@/lib/request-security";

export async function GET(request: Request) {
  const guard = await protectApiRequest(request, { keyPrefix: "desguace:free-locations", limit: 100, windowMs: 60_000 });
  if (guard) return guard;
  try {
    const shelves = await getWarehousePlan();
    return NextResponse.json(shelves.flatMap((shelf) => shelf.huecos
      .filter((slot) => slot.disponible)
      .map((slot) => ({
        ubicacion: slot.ubicacion,
        zona: shelf.zona,
        estanteria_codigo: shelf.codigo,
        estanteria_nombre: shelf.nombre,
        nivel: slot.nivel,
        hueco: slot.hueco,
      }))));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudieron cargar los huecos libres." }, { status: 500 });
  }
}
