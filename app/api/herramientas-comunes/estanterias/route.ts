import { NextResponse } from "next/server";
import { normalizeShelfConfiguration } from "@/lib/herramientas-comunes";
import { protectAdminApiRequest } from "@/lib/request-security";
import { getSupabaseApiConfig, parseSupabaseResponse, supabaseHeaders } from "@/lib/supabase-rest";
import type { EstanteriaHerramientas } from "@/types/herramientas-comunes";

const clean = (value: unknown, length = 100) => String(value ?? "").trim().replace(/\s+/g, " ").slice(0, length);

export async function POST(request: Request) {
  const guard = await protectAdminApiRequest(request, { keyPrefix: "common-tools:shelves-create", limit: 20, windowMs: 60_000 });
  if (guard) return guard;
  try {
    const body = await request.json();
    const codigo = clean(body.codigo, 20).toUpperCase();
    const nombre = clean(body.nombre, 100);
    const zona = clean(body.zona, 100);
    const configuracion = normalizeShelfConfiguration(body.configuracion);
    if (!/^[A-Z0-9-]{2,20}$/.test(codigo) || !nombre || !zona || !configuracion.filas.length) return NextResponse.json({ error: "Indica código, nombre, zona y al menos una fila." }, { status: 400 });
    const { url, key } = getSupabaseApiConfig();
    const orderResponse = await fetch(`${url}/rest/v1/herramientas_comunes_estanterias?select=orden&order=orden.desc&limit=1`, { headers: supabaseHeaders(key) });
    const maxOrder = Number((await parseSupabaseResponse<Array<{ orden: number }>>(orderResponse))[0]?.orden || 0);
    const response = await fetch(`${url}/rest/v1/herramientas_comunes_estanterias?select=*`, { method: "POST", headers: supabaseHeaders(key, { Prefer: "return=representation" }), body: JSON.stringify({ codigo, nombre, zona, niveles: configuracion.filas.length, orden: maxOrder + 1, activa: true, configuracion }) });
    return NextResponse.json((await parseSupabaseResponse<EstanteriaHerramientas[]>(response))[0], { status: 201 });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo crear la estantería." }, { status: 500 }); }
}
