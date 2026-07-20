import { NextResponse } from "next/server";
import { getDrawers } from "@/lib/almacen-desguace-cajones";
import { UBICACION_PATTERN } from "@/lib/almacen-desguace";
import { getLocationParts, getShelves } from "@/lib/almacen-desguace-estanterias";
import { protectApiRequest } from "@/lib/request-security";
import { getSupabaseApiConfig, parseSupabaseResponse, supabaseHeaders } from "@/lib/supabase-rest";

function drawerInput(value: unknown) {
  const source = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
  return {
    nombre: String(source.nombre || "").trim(),
    descripcion: String(source.descripcion || "").trim() || null,
    ubicacion: String(source.ubicacion || "").trim().toUpperCase(),
    capacidad_maxima: Number(source.capacidad_maxima || 0),
  };
}

export async function GET(request: Request) {
  const guard = await protectApiRequest(request, { keyPrefix: "desguace:drawers", limit: 100, windowMs: 60_000 });
  if (guard) return guard;
  try { return NextResponse.json(await getDrawers()); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudieron cargar los cajones." }, { status: 500 }); }
}

export async function POST(request: Request) {
  const guard = await protectApiRequest(request, { keyPrefix: "desguace:drawers-create", limit: 30, windowMs: 60_000 });
  if (guard) return guard;
  try {
    const input = drawerInput(await request.json());
    if (!input.nombre) return NextResponse.json({ error: "Indica un nombre para el cajón." }, { status: 400 });
    if (!UBICACION_PATTERN.test(input.ubicacion)) return NextResponse.json({ error: "La ubicación debe tener el formato DESGUACE-E01-N01-C01." }, { status: 400 });
    if (!Number.isInteger(input.capacidad_maxima) || input.capacidad_maxima < 1) return NextResponse.json({ error: "La capacidad debe ser un número entero mayor que cero." }, { status: 400 });
    const parts = getLocationParts(input.ubicacion);
    const shelf = (await getShelves()).find((item) => item.codigo === parts?.shelfCode);
    if (!parts || !shelf || parts.level > shelf.niveles || parts.slot > shelf.huecos_por_nivel) return NextResponse.json({ error: "Ese hueco no existe en las estanterías configuradas." }, { status: 400 });
    const physicalPosition = (parts.level - 1) * shelf.huecos_por_nivel + parts.slot;
    if (!shelf.activa || physicalPosition > shelf.capacidad_maxima) return NextResponse.json({ error: "Ese hueco no está disponible en la estantería." }, { status: 409 });
    const { url, key } = getSupabaseApiConfig();
    const response = await fetch(`${url}/rest/v1/almacen_desguace_cajones?select=*`, {
      method: "POST", headers: supabaseHeaders(key, { Prefer: "return=representation" }), body: JSON.stringify(input),
    });
    const rows = await parseSupabaseResponse<unknown[]>(response);
    return NextResponse.json(rows[0], { status: 201 });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo crear el cajón." }, { status: 500 }); }
}
