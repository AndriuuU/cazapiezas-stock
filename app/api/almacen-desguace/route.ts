import { NextResponse } from "next/server";
import { normalizePiezaInput, requiresPublishValidation, validatePieza, validateReadyToPublish } from "@/lib/almacen-desguace";
import { protectApiRequest } from "@/lib/request-security";
import { getSupabaseApiConfig, parseSupabaseResponse, supabaseHeaders } from "@/lib/supabase-rest";
import type { PiezaDesguace } from "@/types/almacen-desguace";
import { withPublicPhotos } from "@/lib/almacen-desguace-data";

const SEARCH_FIELDS = [
  "codigo_interno", "nombre_pieza", "referencia_principal", "referencia_oem",
  "marca_pieza", "marca_vehiculo", "modelo_vehiculo", "matricula_vehiculo", "codigo_motor", "ubicacion",
];
let categoryCache: { values: string[]; expiresAt: number } | undefined;

async function getCategories(url: string, key: string) {
  if (categoryCache && categoryCache.expiresAt > Date.now()) return categoryCache.values;
  const params = new URLSearchParams({
    select: "categoria",
    categoria: "not.is.null",
    order: "categoria.asc",
    limit: "1000",
  });
  const response = await fetch(`${url}/rest/v1/almacen_desguace_piezas?${params}`, {
    headers: supabaseHeaders(key), cache: "no-store",
  });
  const rows = await parseSupabaseResponse<Array<{ categoria: string | null }>>(response);
  const values = [...new Set(rows.map((row) => row.categoria?.trim()).filter((value): value is string => Boolean(value)))];
  categoryCache = { values, expiresAt: Date.now() + 5 * 60_000 };
  return values;
}

export async function GET(request: Request) {
  const guard = await protectApiRequest(request, { keyPrefix: "desguace:list", limit: 100, windowMs: 60_000 });
  if (guard) return guard;

  try {
    const query = new URL(request.url).searchParams;
    const allIds = query.get("all_ids") === "true";
    const pageSize = allIds ? 1000 : Math.min(100, Math.max(10, Number(query.get("page_size") || 25)));
    const page = Math.max(1, Number(query.get("page") || 1));
    const offset = allIds ? 0 : (page - 1) * pageSize;
    const sortOptions: Record<string, string> = {
      "created_at.desc": "created_at.desc",
      "created_at.asc": "created_at.asc",
      "nombre.asc": "nombre_pieza.asc.nullslast",
      "referencia.asc": "referencia_principal.asc.nullslast",
      "ubicacion.asc": "ubicacion.asc.nullslast",
      "precio.desc": "precio_venta.desc.nullslast",
      "precio.asc": "precio_venta.asc.nullslast",
    };
    const params = new URLSearchParams({
      select: allIds ? "id" : "*,fotos:almacen_desguace_fotos(*),cajon:almacen_desguace_cajones(id,codigo,nombre,ubicacion)",
      order: sortOptions[query.get("sort") || "created_at.desc"] || sortOptions["created_at.desc"],
      limit: String(pageSize),
      offset: String(offset),
    });
    const requestedView = query.get("vista");
    const view = requestedView === "retiradas" || requestedView === "vendidas" ? requestedView : "almacen";
    params.set("estado_proceso", view === "retiradas" ? "eq.Retirada" : view === "vendidas" ? "eq.Vendida" : "not.in.(Retirada,Vendida)");
    const search = (query.get("q") || "").trim().replace(/[,().*]/g, " ").replace(/\s+/g, " ");
    if (search) {
      const terms = search.split(" ").filter(Boolean).slice(0, 5);
      const termFilters = terms.map((term) => `or(${SEARCH_FIELDS.map((field) => `${field}.ilike.*${term}*`).join(",")})`);
      if (termFilters.length === 1) params.set("or", `(${SEARCH_FIELDS.map((field) => `${field}.ilike.*${terms[0]}*`).join(",")})`);
      else params.set("and", `(${termFilters.join(",")})`);
    }
    const filters: Record<string, string> = {
      categoria: "categoria",
      estado_pieza: "estado_pieza",
      estado_proceso: "estado_proceso",
      ubicacion: "ubicacion",
    };
    for (const [queryKey, column] of Object.entries(filters)) {
      const value = query.get(queryKey)?.trim();
      if (value && queryKey !== "estado_proceso") params.set(column, queryKey === "ubicacion" ? `ilike.${value}*` : `eq.${value}`);
      if (value && queryKey === "estado_proceso" && view === "almacen" && value !== "Retirada" && value !== "Vendida") params.set(column, `eq.${value}`);
    }
    const published = query.get("publicado_online");
    if (published === "true" || published === "false") params.set("publicado_online", `eq.${published}`);

    const { url, key } = getSupabaseApiConfig();
    let response = await fetch(`${url}/rest/v1/almacen_desguace_piezas?${params}`, {
      headers: supabaseHeaders(key, { Prefer: "count=exact" }), cache: "no-store",
    });
    if (!response.ok && !allIds) {
      params.set("select", "*,fotos:almacen_desguace_fotos(*)");
      for (const keyName of ["or", "and"]) {
        const value = params.get(keyName);
        if (value) params.set(keyName, value.replace(/matricula_vehiculo\.ilike\.\*[^*]+\*,?/g, ""));
      }
      response = await fetch(`${url}/rest/v1/almacen_desguace_piezas?${params}`, {
        headers: supabaseHeaders(key, { Prefer: "count=exact" }), cache: "no-store",
      });
    }
    const contentRange = response.headers.get("content-range");
    const totalValue = contentRange?.split("/")[1];
    const piezas = await parseSupabaseResponse<PiezaDesguace[]>(response);
    if (allIds) {
      const total = totalValue && totalValue !== "*" ? Number(totalValue) : piezas.length;
      return NextResponse.json({ ids: piezas.map((pieza) => pieza.id), total }, { headers: { "Cache-Control": "no-store" } });
    }
    const items = await Promise.all(piezas.map(async (pieza) => {
      const principal = (pieza.fotos || []).find((foto) => foto.es_principal) || pieza.fotos?.[0];
      return principal ? { ...pieza, fotos: [(await withPublicPhotos({ ...pieza, fotos: [principal] })).fotos![0]] } : pieza;
    }));
    const total = totalValue && totalValue !== "*" ? Number(totalValue) : items.length;
    return NextResponse.json({
      items,
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
      categories: await getCategories(url, key),
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo cargar el almacén." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const guard = await protectApiRequest(request, { keyPrefix: "desguace:create", limit: 30, windowMs: 60_000 });
  if (guard) return guard;

  try {
    const input = normalizePiezaInput(await request.json());
    input.publicado_online = false;
    if (input.estado_proceso === "Retirada" || input.estado_proceso === "Vendida") Object.assign(input, { publicado_online: false, ubicacion: null, cajon_id: null });
    const errors = validatePieza(input);
    if (errors.length) return NextResponse.json({ error: errors.join(" ") }, { status: 400 });
    if (requiresPublishValidation(input.estado_proceso)) {
      const missing = validateReadyToPublish(input, 0);
      if (missing.length) {
        return NextResponse.json(
          { error: `Para publicar faltan: ${missing.join(", ")}. Guarda primero el borrador y añade sus fotografías.` },
          { status: 400 }
        );
      }
    }

    const { url, key } = getSupabaseApiConfig();
    const response = await fetch(`${url}/rest/v1/almacen_desguace_piezas?select=*`, {
      method: "POST",
      headers: supabaseHeaders(key, { Prefer: "return=representation" }),
      body: JSON.stringify(input),
    });
    const rows = await parseSupabaseResponse<PiezaDesguace[]>(response);
    return NextResponse.json(rows[0], { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo guardar la pieza." }, { status: 500 });
  }
}
