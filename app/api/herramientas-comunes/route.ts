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
    if (!nombre) return NextResponse.json({ error: "Indica el nombre de la herramienta." }, { status: 400 });
    const { url, key } = getSupabaseApiConfig();
    const fotoUrl = clean(body.foto_url, 1000);
    if (fotoUrl && !/^https?:\/\//i.test(fotoUrl)) return NextResponse.json({ error: "La foto debe ser un enlace web válido." }, { status: 400 });
    const hasAnyLocation = body.estanteria_id != null || body.nivel != null || clean(body.posicion, 80) !== "";
    const shelfId = Number(body.estanteria_id); const level = Number(body.nivel); const position = clean(body.posicion, 80).toUpperCase();
    let selectedShelf: EstanteriaHerramientas | null = null;
    if (hasAnyLocation) {
      if (!Number.isInteger(shelfId) || !Number.isInteger(level) || !position) return NextResponse.json({ error: "Completa la estantería, el nivel y el compartimento, o deja la ubicación vacía." }, { status: 400 });
      const shelfParams = new URLSearchParams({ select: "*", id: `eq.${shelfId}`, activa: "eq.true", limit: "1" });
      const shelfResponse = await fetch(`${url}/rest/v1/herramientas_comunes_estanterias?${shelfParams}`, { headers: supabaseHeaders(key) });
      selectedShelf = (await parseSupabaseResponse<EstanteriaHerramientas[]>(shelfResponse))[0] || null;
      if (!selectedShelf || !shelfPositionExists(selectedShelf.configuracion, level, position)) return NextResponse.json({ error: "La ubicación elegida ya no existe en el plano." }, { status: 400 });
    }
    const payload = {
      nombre,
      categoria: clean(body.categoria, 100) || null,
      marca: clean(body.marca, 100) || null,
      descripcion: clean(body.descripcion, 500) || null,
      solo_localizacion: body.solo_localizacion === true || body.solo_localizacion === "true" || body.solo_localizacion === "on",
      espacio_ocupado: clean(body.espacio_ocupado, 150) || null,
      foto_url: fotoUrl || null,
      estanteria_id: selectedShelf ? shelfId : null,
      nivel: selectedShelf ? level : null,
      posicion: selectedShelf ? position : null,
    };
    const response = await fetch(`${url}/rest/v1/herramientas_comunes_herramientas?select=*`, {
      method: "POST", headers: supabaseHeaders(key, { Prefer: "return=representation" }), body: JSON.stringify(payload),
    });
    const tool = (await parseSupabaseResponse<HerramientaComun[]>(response))[0];
    await fetch(`${url}/rest/v1/herramientas_comunes_movimientos`, {
      method: "POST", headers: supabaseHeaders(key), body: JSON.stringify({ herramienta_id: tool.id, tipo: "alta", empleado: signedUser?.nombre || "Administrador", estado_nuevo: "disponible", detalle: selectedShelf ? `Registrada en ${selectedShelf.codigo} · nivel ${level} · ${position}.` : "Registrada sin ubicación. Pendiente de colocar mediante QR o desde el plano." }),
    });
    return NextResponse.json(tool, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo registrar la herramienta." }, { status: 500 });
  }
}
