import { NextResponse } from "next/server";
import { getRequestUser } from "@/lib/auth";
import { shelfPositionExists } from "@/lib/herramientas-comunes";
import { protectAdminApiRequest, protectApiRequest } from "@/lib/request-security";
import { getSupabaseApiConfig, parseSupabaseResponse, supabaseHeaders } from "@/lib/supabase-rest";
import type { EstanteriaHerramientas, FotoHerramientaComun, HerramientaComun, MovimientoHerramienta } from "@/types/herramientas-comunes";

const clean = (value: unknown, length = 200) => String(value ?? "").trim().replace(/\s+/g, " ").slice(0, length);

export async function GET(request: Request) {
  const guard = await protectApiRequest(request, { keyPrefix: "common-tools:list", limit: 100, windowMs: 60_000 });
  if (guard) return guard;
  try {
    const { url, key } = getSupabaseApiConfig();
    const [shelvesResponse, toolsResponse, movementsResponse, photosResponse] = await Promise.all([
      fetch(`${url}/rest/v1/herramientas_comunes_estanterias?select=*&activa=eq.true&order=orden.asc`, { headers: supabaseHeaders(key), cache: "no-store" }),
      fetch(`${url}/rest/v1/herramientas_comunes_herramientas?select=*,estanteria:herramientas_comunes_estanterias(*)&order=nombre.asc`, { headers: supabaseHeaders(key), cache: "no-store" }),
      fetch(`${url}/rest/v1/herramientas_comunes_movimientos?select=*&order=created_at.desc&limit=500`, { headers: supabaseHeaders(key), cache: "no-store" }),
      fetch(`${url}/rest/v1/herramientas_comunes_fotos?select=*&order=created_at.asc`, { headers: supabaseHeaders(key), cache: "no-store" }),
    ]);
    const [shelves, tools, movements] = await Promise.all([
      parseSupabaseResponse<EstanteriaHerramientas[]>(shelvesResponse),
      parseSupabaseResponse<HerramientaComun[]>(toolsResponse),
      parseSupabaseResponse<MovimientoHerramienta[]>(movementsResponse),
    ]);
    const photos = photosResponse.ok ? await parseSupabaseResponse<FotoHerramientaComun[]>(photosResponse) : [];
    const toolsWithPhotos = tools.map((tool) => ({ ...tool, fotos: photos.filter((photo) => photo.herramienta_id === tool.id) }));
    if (shelves.some((shelf) => !shelf.configuracion)) {
      return NextResponse.json({ error: "Falta aplicar la actualización del plano de estanterías.", setupRequired: true }, { status: 503 });
    }
    return NextResponse.json({ shelves, tools: toolsWithPhotos, movements }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudieron cargar las herramientas.", setupRequired: true }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const guard = await protectAdminApiRequest(request, { keyPrefix: "common-tools:create", limit: 30, windowMs: 60_000 });
  if (guard) return guard;
  try {
    const signedUser = await getRequestUser(request);
    const body = await request.json();
    const nombre = clean(body.nombre, 150);
    const estanteriaId = Number(body.estanteria_id);
    const nivel = Number(body.nivel);
    const posicion = clean(body.posicion, 80);
    if (!nombre || !Number.isInteger(estanteriaId) || !Number.isInteger(nivel) || nivel < 1 || !posicion) {
      return NextResponse.json({ error: "Indica nombre, estantería, nivel y posición." }, { status: 400 });
    }
    const { url, key } = getSupabaseApiConfig();
    const shelfParams = new URLSearchParams({ select: "*", id: `eq.${estanteriaId}`, limit: "1" });
    const shelfResponse = await fetch(`${url}/rest/v1/herramientas_comunes_estanterias?${shelfParams}`, { headers: supabaseHeaders(key) });
    const shelf = (await parseSupabaseResponse<EstanteriaHerramientas[]>(shelfResponse))[0];
    if (!shelf || !shelfPositionExists(shelf.configuracion, nivel, posicion)) return NextResponse.json({ error: "La ubicación seleccionada no es válida." }, { status: 400 });
    const fotoUrl = clean(body.foto_url, 1000);
    if (fotoUrl && !/^https?:\/\//i.test(fotoUrl)) return NextResponse.json({ error: "La foto debe ser un enlace web válido." }, { status: 400 });
    const payload = {
      ...(clean(body.codigo, 40) && { codigo: clean(body.codigo, 40).toUpperCase() }),
      nombre,
      categoria: clean(body.categoria, 100) || null,
      marca: clean(body.marca, 100) || null,
      descripcion: clean(body.descripcion, 500) || null,
      foto_url: fotoUrl || null,
      estanteria_id: estanteriaId,
      nivel,
      posicion,
    };
    const response = await fetch(`${url}/rest/v1/herramientas_comunes_herramientas?select=*`, {
      method: "POST", headers: supabaseHeaders(key, { Prefer: "return=representation" }), body: JSON.stringify(payload),
    });
    const tool = (await parseSupabaseResponse<HerramientaComun[]>(response))[0];
    await fetch(`${url}/rest/v1/herramientas_comunes_movimientos`, {
      method: "POST", headers: supabaseHeaders(key), body: JSON.stringify({ herramienta_id: tool.id, tipo: "alta", empleado: signedUser?.nombre || "Administrador", estado_nuevo: "disponible", detalle: `Ubicación inicial: ${shelf.codigo} · nivel ${nivel} · ${posicion}` }),
    });
    return NextResponse.json(tool, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo registrar la herramienta." }, { status: 500 });
  }
}
