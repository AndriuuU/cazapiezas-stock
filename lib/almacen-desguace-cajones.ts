import "server-only";

import { getSupabaseApiConfig, parseSupabaseResponse, supabaseHeaders } from "@/lib/supabase-rest";
import { withPublicPhotos } from "@/lib/almacen-desguace-data";
import type { CajonDesguace, MovimientoCajon, PiezaDesguace } from "@/types/almacen-desguace";

type CajonRow = Omit<CajonDesguace, "cantidad_piezas" | "disponibles" | "porcentaje_ocupacion" | "lleno" | "piezas" | "movimientos">;

function enrichDrawer(row: CajonRow, count: number, searchableContent = ""): CajonDesguace {
  return {
    ...row,
    cantidad_piezas: count,
    disponibles: Math.max(0, row.capacidad_maxima - count),
    porcentaje_ocupacion: Math.min(100, Math.round((count / row.capacidad_maxima) * 100)),
    lleno: row.lleno_manual || count >= row.capacidad_maxima,
    contenido_busqueda: searchableContent,
  };
}

export async function getDrawers() {
  const { url, key } = getSupabaseApiConfig();
  const [drawerResponse, pieceResponse] = await Promise.all([
    fetch(`${url}/rest/v1/almacen_desguace_cajones?select=*&order=codigo.asc&limit=1000`, { headers: supabaseHeaders(key), cache: "no-store" }),
    fetch(`${url}/rest/v1/almacen_desguace_piezas?select=cajon_id,nombre_pieza,categoria,marca_pieza,referencia_principal,referencia_oem&cajon_id=not.is.null&limit=10000`, { headers: supabaseHeaders(key), cache: "no-store" }),
  ]);
  const [drawers, pieces] = await Promise.all([
    parseSupabaseResponse<CajonRow[]>(drawerResponse),
    parseSupabaseResponse<Array<Pick<PiezaDesguace, "cajon_id" | "nombre_pieza" | "categoria" | "marca_pieza" | "referencia_principal" | "referencia_oem">>>(pieceResponse),
  ]);
  const counts = new Map<number, number>();
  const searchableContent = new Map<number, string[]>();
  pieces.forEach((piece) => {
    if (piece.cajon_id == null) return;
    counts.set(piece.cajon_id, (counts.get(piece.cajon_id) || 0) + 1);
    searchableContent.set(piece.cajon_id, [...(searchableContent.get(piece.cajon_id) || []), piece.nombre_pieza || "", piece.categoria || "", piece.marca_pieza || "", piece.referencia_principal || "", piece.referencia_oem || ""]);
  });
  return drawers.map((drawer) => enrichDrawer(drawer, counts.get(drawer.id) || 0, (searchableContent.get(drawer.id) || []).join(" ")));
}

export async function getDrawer(id: string | number) {
  const { url, key } = getSupabaseApiConfig();
  const drawerParams = new URLSearchParams({ select: "*", id: `eq.${id}`, limit: "1" });
  const pieceParams = new URLSearchParams({ select: "*,fotos:almacen_desguace_fotos(*)", cajon_id: `eq.${id}`, order: "nombre_pieza.asc.nullslast", limit: "5000" });
  const movementParams = new URLSearchParams({
    select: "*,pieza:almacen_desguace_piezas(id,codigo_interno,nombre_pieza)", cajon_id: `eq.${id}`, order: "created_at.desc", limit: "500",
  });
  const [drawerResponse, pieceResponse, movementResponse] = await Promise.all([
    fetch(`${url}/rest/v1/almacen_desguace_cajones?${drawerParams}`, { headers: supabaseHeaders(key), cache: "no-store" }),
    fetch(`${url}/rest/v1/almacen_desguace_piezas?${pieceParams}`, { headers: supabaseHeaders(key), cache: "no-store" }),
    fetch(`${url}/rest/v1/almacen_desguace_cajones_movimientos?${movementParams}`, { headers: supabaseHeaders(key), cache: "no-store" }),
  ]);
  const [drawers, pieces, movements] = await Promise.all([
    parseSupabaseResponse<CajonRow[]>(drawerResponse),
    parseSupabaseResponse<PiezaDesguace[]>(pieceResponse),
    parseSupabaseResponse<MovimientoCajon[]>(movementResponse),
  ]);
  if (!drawers[0]) return null;
  const piecesWithPhotos = await Promise.all(pieces.map((piece) => {
    const principal = (piece.fotos || []).find((photo) => photo.es_principal) || piece.fotos?.[0];
    return principal ? withPublicPhotos({ ...piece, fotos: [principal] }) : piece;
  }));
  return { ...enrichDrawer(drawers[0], pieces.length), piezas: piecesWithPhotos, movimientos: movements };
}
