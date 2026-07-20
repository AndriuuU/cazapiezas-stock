import { NextResponse } from "next/server";
import { getDrawer } from "@/lib/almacen-desguace-cajones";
import { UBICACION_PATTERN } from "@/lib/almacen-desguace";
import { getLocationParts, getShelves } from "@/lib/almacen-desguace-estanterias";
import { protectApiRequest } from "@/lib/request-security";
import { getSupabaseApiConfig, parseSupabaseResponse, supabaseHeaders } from "@/lib/supabase-rest";

type Context = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: Context) {
  const guard = await protectApiRequest(request, { keyPrefix: "desguace:drawer-detail", limit: 100, windowMs: 60_000 });
  if (guard) return guard;
  try {
    const drawer = await getDrawer((await context.params).id);
    return drawer ? NextResponse.json(drawer) : NextResponse.json({ error: "Cajón no encontrado." }, { status: 404 });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo cargar el cajón." }, { status: 500 }); }
}

export async function PATCH(request: Request, context: Context) {
  const guard = await protectApiRequest(request, { keyPrefix: "desguace:drawer-update", limit: 60, windowMs: 60_000 });
  if (guard) return guard;
  try {
    const source = await request.json() as Record<string, unknown>;
    const patch: Record<string, unknown> = {};
    if ("nombre" in source) patch.nombre = String(source.nombre || "").trim();
    if ("descripcion" in source) patch.descripcion = String(source.descripcion || "").trim() || null;
    if ("ubicacion" in source) {
      const location = String(source.ubicacion || "").trim().toUpperCase();
      if (!UBICACION_PATTERN.test(location)) return NextResponse.json({ error: "La ubicación debe tener el formato DESGUACE-E01-N01-C01." }, { status: 400 });
      const parts = getLocationParts(location);
      const shelf = (await getShelves()).find((item) => item.codigo === parts?.shelfCode);
      if (!parts || !shelf || parts.level > shelf.niveles || parts.slot > shelf.huecos_por_nivel) return NextResponse.json({ error: "Ese hueco no existe en las estanterías configuradas." }, { status: 400 });
      const physicalPosition = (parts.level - 1) * shelf.huecos_por_nivel + parts.slot;
      if (!shelf.activa || physicalPosition > shelf.capacidad_maxima) return NextResponse.json({ error: "Ese hueco no está disponible en la estantería." }, { status: 409 });
      patch.ubicacion = location;
    }
    if ("capacidad_maxima" in source) {
      const capacity = Number(source.capacidad_maxima);
      if (!Number.isInteger(capacity) || capacity < 1) return NextResponse.json({ error: "La capacidad debe ser mayor que cero." }, { status: 400 });
      patch.capacidad_maxima = capacity;
    }
    if ("lleno_manual" in source) patch.lleno_manual = Boolean(source.lleno_manual);
    if ("activo" in source) patch.activo = Boolean(source.activo);
    const { id } = await context.params;
    const { url, key } = getSupabaseApiConfig();
    const params = new URLSearchParams({ id: `eq.${id}`, select: "*" });
    const response = await fetch(`${url}/rest/v1/almacen_desguace_cajones?${params}`, {
      method: "PATCH", headers: supabaseHeaders(key, { Prefer: "return=representation" }), body: JSON.stringify(patch),
    });
    const rows = await parseSupabaseResponse<unknown[]>(response);
    return rows[0] ? NextResponse.json(rows[0]) : NextResponse.json({ error: "Cajón no encontrado." }, { status: 404 });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo actualizar el cajón." }, { status: 500 }); }
}

export async function DELETE(request: Request, context: Context) {
  const guard = await protectApiRequest(request, { keyPrefix: "desguace:drawer-delete", limit: 20, windowMs: 60_000 });
  if (guard) return guard;
  try {
    const { id } = await context.params;
    const drawer = await getDrawer(id);
    if (!drawer) return NextResponse.json({ error: "Cajón no encontrado." }, { status: 404 });
    if (drawer.cantidad_piezas) return NextResponse.json({ error: "Retira primero todas las piezas del cajón." }, { status: 409 });
    const { url, key } = getSupabaseApiConfig();
    const response = await fetch(`${url}/rest/v1/almacen_desguace_cajones?id=eq.${encodeURIComponent(id)}`, { method: "DELETE", headers: supabaseHeaders(key) });
    if (!response.ok) await parseSupabaseResponse(response);
    return NextResponse.json({ ok: true });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo eliminar el cajón." }, { status: 500 }); }
}
