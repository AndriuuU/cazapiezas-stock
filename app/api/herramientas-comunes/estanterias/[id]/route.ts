import { NextResponse } from "next/server";
import { normalizeShelfConfiguration } from "@/lib/herramientas-comunes";
import { protectAdminApiRequest } from "@/lib/request-security";
import { getSupabaseApiConfig, parseSupabaseResponse, supabaseHeaders } from "@/lib/supabase-rest";
import type { EstanteriaHerramientas } from "@/types/herramientas-comunes";

type Context = { params: Promise<{ id: string }> };
const clean = (value: unknown, length = 100) => String(value ?? "").trim().replace(/\s+/g, " ").slice(0, length);

export async function PATCH(request: Request, context: Context) {
  const guard = await protectAdminApiRequest(request, { keyPrefix: "common-tools:shelves-update", limit: 30, windowMs: 60_000 });
  if (guard) return guard;
  try {
    const { id } = await context.params; const body = await request.json();
    const codigo = clean(body.codigo, 20).toUpperCase(); const nombre = clean(body.nombre, 100); const zona = clean(body.zona, 100);
    const configuracion = normalizeShelfConfiguration(body.configuracion);
    if (!/^\d+$/.test(id) || !/^[A-Z0-9-]{2,20}$/.test(codigo) || !nombre || !zona || !configuracion.filas.length) return NextResponse.json({ error: "Revisa los datos de la estantería." }, { status: 400 });
    const { url, key } = getSupabaseApiConfig();
    const toolsResponse = await fetch(`${url}/rest/v1/herramientas_comunes_herramientas?select=id,nivel,posicion&estanteria_id=eq.${id}`, { headers: supabaseHeaders(key) });
    const tools = await parseSupabaseResponse<Array<{ id: number; nivel: number; posicion: string }>>(toolsResponse);
    const invalid = tools.find((tool) => { const row = configuracion.filas.find((item) => item.nivel === tool.nivel); const column = Number(/^C(\d+)$/i.exec(tool.posicion)?.[1] || 1); return !row || column > row.columnas; });
    if (invalid) return NextResponse.json({ error: "No puedes eliminar una fila o división que todavía contiene herramientas. Muévelas primero." }, { status: 409 });
    const params = new URLSearchParams({ id: `eq.${id}`, select: "*" });
    const response = await fetch(`${url}/rest/v1/herramientas_comunes_estanterias?${params}`, { method: "PATCH", headers: supabaseHeaders(key, { Prefer: "return=representation" }), body: JSON.stringify({ codigo, nombre, zona, niveles: configuracion.filas.length, configuracion }) });
    return NextResponse.json((await parseSupabaseResponse<EstanteriaHerramientas[]>(response))[0]);
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo actualizar la estantería." }, { status: 500 }); }
}

export async function DELETE(request: Request, context: Context) {
  const guard = await protectAdminApiRequest(request, { keyPrefix: "common-tools:shelves-delete", limit: 15, windowMs: 60_000 });
  if (guard) return guard;
  try {
    const { id } = await context.params; if (!/^\d+$/.test(id)) return NextResponse.json({ error: "Estantería no válida." }, { status: 400 });
    const { url, key } = getSupabaseApiConfig();
    const countResponse = await fetch(`${url}/rest/v1/herramientas_comunes_herramientas?select=id&estanteria_id=eq.${id}&limit=1`, { headers: supabaseHeaders(key) });
    if ((await parseSupabaseResponse<Array<{ id: number }>>(countResponse)).length) return NextResponse.json({ error: "Mueve primero las herramientas de esta estantería." }, { status: 409 });
    const params = new URLSearchParams({ id: `eq.${id}` });
    const response = await fetch(`${url}/rest/v1/herramientas_comunes_estanterias?${params}`, { method: "PATCH", headers: supabaseHeaders(key), body: JSON.stringify({ activa: false }) });
    if (!response.ok) throw new Error("No se pudo retirar la estantería.");
    return NextResponse.json({ ok: true });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo retirar la estantería." }, { status: 500 }); }
}
