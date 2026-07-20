import type { CajonDesguace, EstanteriaDesguace, EstanteriaPlanoAlmacen, PiezaDesguace, SugerenciaUbicacion } from "@/types/almacen-desguace";
import { getSupabaseApiConfig, parseSupabaseResponse, supabaseHeaders } from "@/lib/supabase-rest";

type PiezaParaSugerencia = Partial<Pick<PiezaDesguace, "categoria" | "nombre_pieza" | "descripcion" | "marca_pieza" | "marca_vehiculo" | "modelo_vehiculo">>;
type EstanteriaRow = Omit<EstanteriaDesguace, "ocupados" | "disponibles" | "porcentaje_ocupacion" | "llena" | "motivo_llena" | "siguiente_ubicacion" | "siguientes_ubicaciones_por_nivel">;

export function getShelfCode(location?: string | null) {
  return location?.match(/^DESGUACE-(E\d{2})-N\d{2}-C\d{2}$/)?.[1] || null;
}

export function getLocationParts(location?: string | null) {
  const match = location?.match(/^DESGUACE-(E\d{2})-N(\d{2})-C(\d{2})$/);
  return match ? { shelfCode: match[1], level: Number(match[2]), slot: Number(match[3]) } : null;
}

function firstFreeLocationInLevels(shelf: EstanteriaRow, occupied: Set<string>, from = 1, to = shelf.niveles) {
  for (let level = from; level <= to; level++) {
    for (let slot = 1; slot <= shelf.huecos_por_nivel; slot++) {
      const position = (level - 1) * shelf.huecos_por_nivel + slot;
      if (position > shelf.capacidad_maxima) continue;
      const location = `DESGUACE-${shelf.codigo}-N${String(level).padStart(2, "0")}-C${String(slot).padStart(2, "0")}`;
      if (!occupied.has(location)) return location;
    }
  }
  return null;
}

export async function getShelves() {
  const { url, key } = getSupabaseApiConfig();
  const shelvesParams = new URLSearchParams({ select: "*", order: "zona.asc,orden_plano.asc,codigo.asc", limit: "500" });
  const locationsParams = new URLSearchParams({ select: "ubicacion,cajon_id", ubicacion: "not.is.null", limit: "10000" });
  const drawersParams = new URLSearchParams({ select: "ubicacion", limit: "5000" });
  const [shelvesResponse, locationsResponse, drawersResponse] = await Promise.all([
    fetch(`${url}/rest/v1/almacen_desguace_estanterias?${shelvesParams}`, { headers: supabaseHeaders(key), cache: "no-store" }),
    fetch(`${url}/rest/v1/almacen_desguace_piezas?${locationsParams}`, { headers: supabaseHeaders(key), cache: "no-store" }),
    fetch(`${url}/rest/v1/almacen_desguace_cajones?${drawersParams}`, { headers: supabaseHeaders(key), cache: "no-store" }),
  ]);
  const shelves = await parseSupabaseResponse<EstanteriaRow[]>(shelvesResponse);
  let locations: Array<{ ubicacion: string; cajon_id: number | null }>;
  let drawers: Array<{ ubicacion: string }>;
  if (locationsResponse.ok && drawersResponse.ok) {
    locations = await parseSupabaseResponse(locationsResponse);
    drawers = await parseSupabaseResponse(drawersResponse);
  } else {
    const legacyParams = new URLSearchParams({ select: "ubicacion", ubicacion: "not.is.null", limit: "10000" });
    const legacyResponse = await fetch(`${url}/rest/v1/almacen_desguace_piezas?${legacyParams}`, { headers: supabaseHeaders(key), cache: "no-store" });
    locations = (await parseSupabaseResponse<Array<{ ubicacion: string }>>(legacyResponse)).map((row) => ({ ...row, cajon_id: null }));
    drawers = [];
  }
  const occupiedLocations = new Set([...locations.filter((row) => row.cajon_id === null).map((row) => row.ubicacion), ...drawers.map((row) => row.ubicacion)]);

  return shelves.map((shelf): EstanteriaDesguace => {
    const occupied = [...occupiedLocations].filter((location) => getShelfCode(location) === shelf.codigo).length;
    const fullByCapacity = occupied >= shelf.capacidad_maxima;
    const full = shelf.llena_manual || fullByCapacity;
    const nextByLevel = Object.fromEntries(Array.from({ length: shelf.niveles }, (_, index) => {
      const level = index + 1;
      return [level, firstFreeLocationInLevels(shelf, occupiedLocations, level, level)];
    }));
    return {
      ...shelf,
      reglas_nivel: Array.isArray(shelf.reglas_nivel) ? shelf.reglas_nivel : [],
      ocupados: occupied,
      disponibles: Math.max(0, shelf.capacidad_maxima - occupied),
      porcentaje_ocupacion: Math.min(100, Math.round((occupied / shelf.capacidad_maxima) * 100)),
      llena: full,
      motivo_llena: shelf.llena_manual ? "manual" : fullByCapacity ? "capacidad" : null,
      siguiente_ubicacion: full ? null : firstFreeLocationInLevels(shelf, occupiedLocations),
      siguientes_ubicaciones_por_nivel: full ? {} : nextByLevel,
    };
  });
}

export async function getWarehousePlan(): Promise<EstanteriaPlanoAlmacen[]> {
  const { url, key } = getSupabaseApiConfig();
  const piecesParams = new URLSearchParams({
    select: "id,codigo_interno,nombre_pieza,categoria,ubicacion,cajon_id",
    ubicacion: "not.is.null",
    cajon_id: "is.null",
    limit: "5000",
  });
  const drawersParams = new URLSearchParams({ select: "*", limit: "5000" });
  const drawerPiecesParams = new URLSearchParams({ select: "cajon_id", cajon_id: "not.is.null", limit: "10000" });
  const [shelves, piecesResponse, drawersResponse, drawerPiecesResponse] = await Promise.all([
    getShelves(),
    fetch(`${url}/rest/v1/almacen_desguace_piezas?${piecesParams}`, {
      headers: supabaseHeaders(key),
      cache: "no-store",
    }),
    fetch(`${url}/rest/v1/almacen_desguace_cajones?${drawersParams}`, { headers: supabaseHeaders(key), cache: "no-store" }),
    fetch(`${url}/rest/v1/almacen_desguace_piezas?${drawerPiecesParams}`, { headers: supabaseHeaders(key), cache: "no-store" }),
  ]);
  const pieces = await parseSupabaseResponse<Array<Pick<PiezaDesguace, "id" | "codigo_interno" | "nombre_pieza" | "categoria" | "ubicacion" | "cajon_id">>>(piecesResponse);
  const drawerRows = await parseSupabaseResponse<Array<Omit<CajonDesguace, "cantidad_piezas" | "disponibles" | "porcentaje_ocupacion" | "lleno">>>(drawersResponse);
  const drawerPieces = await parseSupabaseResponse<Array<{ cajon_id: number }>>(drawerPiecesResponse);
  const drawerCounts = new Map<number, number>();
  drawerPieces.forEach((piece) => drawerCounts.set(piece.cajon_id, (drawerCounts.get(piece.cajon_id) || 0) + 1));
  const drawers = drawerRows.map((drawer) => {
    const count = drawerCounts.get(drawer.id) || 0;
    return { ...drawer, cantidad_piezas: count, disponibles: Math.max(0, drawer.capacidad_maxima - count), porcentaje_ocupacion: Math.min(100, Math.round(count / drawer.capacidad_maxima * 100)), lleno: drawer.lleno_manual || count >= drawer.capacidad_maxima };
  });
  const piecesByLocation = new Map(pieces.map((piece) => [piece.ubicacion, piece]));
  const drawersByLocation = new Map(drawers.map((drawer) => [drawer.ubicacion, drawer]));

  return shelves.map((shelf) => ({
    ...shelf,
    zona: shelf.zona || "Sin zona",
    orden_plano: Number(shelf.orden_plano) || 0,
    huecos: Array.from({ length: shelf.niveles * shelf.huecos_por_nivel }, (_, index) => {
      const level = Math.floor(index / shelf.huecos_por_nivel) + 1;
      const slot = (index % shelf.huecos_por_nivel) + 1;
      const location = `DESGUACE-${shelf.codigo}-N${String(level).padStart(2, "0")}-C${String(slot).padStart(2, "0")}`;
      const piece = piecesByLocation.get(location) || null;
      const drawer = drawersByLocation.get(location) || null;
      return {
        ubicacion: location,
        nivel: level,
        hueco: slot,
        disponible: !piece && !drawer && shelf.activa && !shelf.llena_manual && index < shelf.capacidad_maxima,
        pieza: piece ? {
          id: piece.id,
          codigo_interno: piece.codigo_interno,
          nombre_pieza: piece.nombre_pieza,
          categoria: piece.categoria,
        } : null,
        cajon: drawer ? { id: drawer.id, codigo: drawer.codigo, nombre: drawer.nombre, cantidad_piezas: drawer.cantidad_piezas, capacidad_maxima: drawer.capacidad_maxima, lleno: drawer.lleno } : null,
      };
    }),
  }));
}

function normalize(value: string | null | undefined) {
  return (value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function searchableTerms(value: string) {
  return normalize(value).split(/[^a-z0-9]+/).filter(Boolean).map((term) => term.length > 3 ? term.replace(/(?:es|s)$/, "") : term);
}

function matchesText(ruleValue: string, searchable: string) {
  const available = new Set(searchableTerms(searchable));
  return searchableTerms(ruleValue).some((term) => available.has(term));
}

export function suggestLocations(piece: PiezaParaSugerencia, shelves: EstanteriaDesguace[]) {
  const category = normalize(piece.categoria);
  const searchable = [piece.nombre_pieza, piece.descripcion, piece.categoria, piece.marca_pieza, piece.marca_vehiculo, piece.modelo_vehiculo].filter(Boolean).join(" ");

  return shelves.filter((shelf) => shelf.activa && !shelf.llena && shelf.siguiente_ubicacion).flatMap((shelf) => {
    const ruleCandidates = shelf.reglas_nivel.flatMap((rule) => {
      const location = Array.from({ length: rule.nivel_hasta - rule.nivel_desde + 1 }, (_, index) => rule.nivel_desde + index)
        .map((level) => shelf.siguientes_ubicaciones_por_nivel[level]).find(Boolean) || null;
      if (!location) return [];
      const categoryMatches = rule.categorias.filter((item) => category && normalize(item) === category);
      const keywordMatches = rule.palabras_clave.filter((item) => matchesText(item, searchable));
      const contentMatches = rule.contenido && matchesText(rule.contenido, searchable) ? [rule.contenido] : [];
      const score = categoryMatches.length * 100 + keywordMatches.length * 20 + contentMatches.length * 10;
      if (!score) return [];
      return [{ location, score: score + 5, reasons: [`Niveles ${rule.nivel_desde}${rule.nivel_hasta === rule.nivel_desde ? "" : ` a ${rule.nivel_hasta}`}: ${rule.contenido || "grupo configurado"}`] }];
    });
    const bestRule = ruleCandidates.sort((left, right) => right.score - left.score)[0];
    if (bestRule) return [{ estanteria: shelf, ubicacion: bestRule.location, motivos: bestRule.reasons, puntuacion: bestRule.score } satisfies SugerenciaUbicacion];
    if (shelf.reglas_nivel.length) return [];

    const categoryMatches = shelf.categorias.filter((item) => category && normalize(item) === category);
    const keywordMatches = shelf.palabras_clave.filter((item) => matchesText(item, searchable));
    const general = shelf.categorias.length === 0 && shelf.palabras_clave.length === 0;
    const score = categoryMatches.length * 100 + keywordMatches.length * 10 + (general ? 1 : 0);
    if (!score) return [];
    const reasons = [...categoryMatches.map((item) => `Categoría: ${item}`), ...keywordMatches.map((item) => `Coincide con "${item}"`), ...(general ? ["Estantería general"] : [])];
    return [{ estanteria: shelf, ubicacion: shelf.siguiente_ubicacion!, motivos: reasons, puntuacion: score } satisfies SugerenciaUbicacion];
  }).sort((left, right) => right.puntuacion - left.puntuacion || right.estanteria.disponibles - left.estanteria.disponibles);
}
