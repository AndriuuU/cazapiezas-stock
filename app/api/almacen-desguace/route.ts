import { NextResponse } from "next/server";
import { normalizePiezaInput, validatePieza } from "@/lib/almacen-desguace";
import { protectApiRequest } from "@/lib/request-security";
import { getSupabaseApiConfig, parseSupabaseResponse, supabaseHeaders } from "@/lib/supabase-rest";
import type { EventoAlmacen, PiezaDesguace, VentaDesguace } from "@/types/almacen-desguace";
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

type SaleEvent = Pick<EventoAlmacen, "id" | "pieza_id" | "tipo_evento" | "accion" | "valor_nuevo" | "usuario_nombre" | "metadata" | "created_at">;

async function loadSalesIndex(url: string, key: string) {
  const soldParams = new URLSearchParams({ select: "id,precio_venta", estado_proceso: "eq.Vendida", limit: "10000" });
  const soldResponse = await fetch(`${url}/rest/v1/almacen_desguace_piezas?${soldParams}`, { headers: supabaseHeaders(key), cache: "no-store" });
  const soldPieces = await parseSupabaseResponse<Array<Pick<PiezaDesguace, "id" | "precio_venta">>>(soldResponse);
  if (!soldPieces.length) return new Map<number, VentaDesguace>();
  const params = new URLSearchParams({
    select: "id,pieza_id,tipo_evento,accion,valor_nuevo,usuario_nombre,metadata,created_at",
    pieza_id: `in.(${soldPieces.map((piece) => piece.id).join(",")})`,
    tipo_evento: "in.(edicion_pieza,cambio_proceso)",
    order: "created_at.desc",
    limit: "10000",
  });
  const response = await fetch(`${url}/rest/v1/almacen_desguace_eventos?${params}`, {
    headers: supabaseHeaders(key),
    cache: "no-store",
  });
  if (!response.ok) return new Map<number, VentaDesguace>();
  const events = await parseSupabaseResponse<SaleEvent[]>(response);
  const sales = new Map<number, VentaDesguace>();
  events.forEach((event) => {
    if (event.pieza_id == null || sales.has(event.pieza_id)) return;
    const value = event.valor_nuevo || {};
    const detailedSale = event.metadata?.operacion === "venta" || event.accion === "Venta registrada";
    const legacySale = event.tipo_evento === "cambio_proceso" && value.estado_proceso === "Vendida";
    if (!detailedSale && !legacySale) return;
    const currentPiece = soldPieces.find((piece) => piece.id === event.pieza_id);
    sales.set(event.pieza_id, {
      evento_id: event.id,
      fecha_venta: String(detailedSale ? value.fecha_venta || event.created_at : event.created_at),
      empleado: String(detailedSale ? value.empleado || "Sin indicar" : event.usuario_nombre || "Usuario de almacén"),
      precio_final: Number(detailedSale ? value.precio_final ?? currentPiece?.precio_venta ?? 0 : value.precio_venta ?? currentPiece?.precio_venta ?? 0),
      observaciones: value.observaciones ? String(value.observaciones) : null,
      registrada_at: event.created_at,
    });
  });
  soldPieces.forEach((piece) => {
    if (!sales.has(piece.id)) sales.set(piece.id, {
      evento_id: 0,
      fecha_venta: "",
      empleado: "Sin historial disponible",
      precio_final: Number(piece.precio_venta || 0),
      observaciones: null,
      registrada_at: "",
    });
  });
  return sales;
}

function madridDateKey(value: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Madrid", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
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
      select: allIds ? "id" : "*,fotos:almacen_desguace_fotos(*),cajon:almacen_desguace_cajones(id,codigo,nombre,ubicacion),iam:almacen_desguace_piezas_iam(*)",
      order: sortOptions[query.get("sort") || "created_at.desc"] || sortOptions["created_at.desc"],
      limit: String(pageSize),
      offset: String(offset),
    });
    const requestedView = query.get("vista");
    const view = requestedView === "retiradas" || requestedView === "vendidas" ? requestedView : "almacen";
    params.set("estado_proceso", view === "retiradas" ? "eq.Retirada" : view === "vendidas" ? "eq.Vendida" : "not.in.(Retirada,Vendida)");
    const { url, key } = getSupabaseApiConfig();
    const salesIndex = view === "vendidas" ? await loadSalesIndex(url, key) : new Map<number, VentaDesguace>();
    const saleFrom = /^\d{4}-\d{2}-\d{2}$/.test(query.get("venta_desde") || "") ? query.get("venta_desde")! : "";
    const saleTo = /^\d{4}-\d{2}-\d{2}$/.test(query.get("venta_hasta") || "") ? query.get("venta_hasta")! : "";
    if (view === "vendidas" && (saleFrom || saleTo)) {
      const matchingIds = [...salesIndex.entries()].filter(([, sale]) => {
        const keyDate = madridDateKey(sale.fecha_venta);
        return Boolean(keyDate) && (!saleFrom || keyDate >= saleFrom) && (!saleTo || keyDate <= saleTo);
      }).map(([id]) => id);
      params.set("id", matchingIds.length ? `in.(${matchingIds.join(",")})` : "eq.-1");
    }
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
    const tipoPieza = query.get("tipo_pieza");
    if (tipoPieza === "CAT" || tipoPieza === "IAM") params.set("tipo_pieza", `eq.${tipoPieza}`);

    let salesSummary: { count: number; gross: number; net: number; vat: number; vatRate: number; costs: number; margin: number; average: number; withoutDate: number } | null = null;
    if (view === "vendidas" && !allIds) {
      const summaryParams = new URLSearchParams(params);
      summaryParams.set("select", "id,precio_venta,precio_coste");
      summaryParams.set("limit", "10000");
      summaryParams.set("offset", "0");
      summaryParams.delete("order");
      const summaryResponse = await fetch(`${url}/rest/v1/almacen_desguace_piezas?${summaryParams}`, { headers: supabaseHeaders(key), cache: "no-store" });
      const summaryPieces = await parseSupabaseResponse<Array<Pick<PiezaDesguace, "id" | "precio_venta" | "precio_coste">>>(summaryResponse);
      const vatRate = [0, 4, 10, 21].includes(Number(query.get("iva"))) ? Number(query.get("iva")) : 21;
      const gross = summaryPieces.reduce((sum, piece) => sum + Number(salesIndex.get(piece.id)?.precio_final ?? piece.precio_venta ?? 0), 0);
      const vat = vatRate ? gross * vatRate / (100 + vatRate) : 0;
      const costs = summaryPieces.reduce((sum, piece) => sum + Number(piece.precio_coste || 0), 0);
      salesSummary = {
        count: summaryPieces.length,
        gross: Math.round(gross * 100) / 100,
        net: Math.round((gross - vat) * 100) / 100,
        vat: Math.round(vat * 100) / 100,
        vatRate,
        costs: Math.round(costs * 100) / 100,
        margin: Math.round((gross - vat - costs) * 100) / 100,
        average: summaryPieces.length ? Math.round(gross / summaryPieces.length * 100) / 100 : 0,
        withoutDate: summaryPieces.filter((piece) => !salesIndex.get(piece.id)?.fecha_venta).length,
      };
    }
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
    const enrichedItems = view === "vendidas" ? items.map((piece) => ({ ...piece, venta: salesIndex.get(piece.id) || null })) : items;
    const total = totalValue && totalValue !== "*" ? Number(totalValue) : enrichedItems.length;
    return NextResponse.json({
      items: enrichedItems,
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
      categories: await getCategories(url, key),
      salesSummary,
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
    if (input.estado_proceso === "Vendida") return NextResponse.json({ error: "Primero registra la pieza y después usa el flujo Registrar venta." }, { status: 400 });
    input.publicado_online = input.estado_proceso === "Publicada";
    if (input.estado_proceso === "Retirada") Object.assign(input, { publicado_online: false, ubicacion: null, cajon_id: null });
    const errors = validatePieza(input);
    if (errors.length) return NextResponse.json({ error: errors.join(" ") }, { status: 400 });

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
