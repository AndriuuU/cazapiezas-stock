import type { EstanteriaDesguace, PiezaDesguace, SugerenciaUbicacion } from "@/types/almacen-desguace";
import { getSupabaseApiConfig, parseSupabaseResponse, supabaseHeaders } from "@/lib/supabase-rest";

type PiezaParaSugerencia = Partial<Pick<PiezaDesguace, "categoria" | "nombre_pieza" | "descripcion" | "marca_pieza" | "marca_vehiculo" | "modelo_vehiculo">>;

type EstanteriaRow = Omit<EstanteriaDesguace, "ocupados" | "disponibles" | "porcentaje_ocupacion" | "llena" | "motivo_llena" | "siguiente_ubicacion">;

export function getShelfCode(location?: string | null) {
  return location?.match(/^DESGUACE-(E\d{2})-N\d{2}-C\d{2}$/)?.[1] || null;
}

export function getLocationParts(location?: string | null) {
  const match = location?.match(/^DESGUACE-(E\d{2})-N(\d{2})-C(\d{2})$/);
  return match ? { shelfCode: match[1], level: Number(match[2]), slot: Number(match[3]) } : null;
}

function firstFreeLocation(shelf: EstanteriaRow, occupied: Set<string>) {
  for (let level = 1; level <= shelf.niveles; level++) {
    for (let slot = 1; slot <= shelf.huecos_por_nivel; slot++) {
      const location = `DESGUACE-${shelf.codigo}-N${String(level).padStart(2, "0")}-C${String(slot).padStart(2, "0")}`;
      if (!occupied.has(location)) return location;
    }
  }
  return null;
}

export async function getShelves() {
  const { url, key } = getSupabaseApiConfig();
  const shelvesParams = new URLSearchParams({ select: "*", order: "codigo.asc", limit: "500" });
  const locationsParams = new URLSearchParams({ select: "ubicacion", ubicacion: "not.is.null", limit: "5000" });
  const [shelvesResponse, locationsResponse] = await Promise.all([
    fetch(`${url}/rest/v1/almacen_desguace_estanterias?${shelvesParams}`, { headers: supabaseHeaders(key), cache: "no-store" }),
    fetch(`${url}/rest/v1/almacen_desguace_piezas?${locationsParams}`, { headers: supabaseHeaders(key), cache: "no-store" }),
  ]);
  const shelves = await parseSupabaseResponse<EstanteriaRow[]>(shelvesResponse);
  const locations = await parseSupabaseResponse<Array<{ ubicacion: string }>>(locationsResponse);
  const occupiedLocations = new Set(locations.map((row) => row.ubicacion));

  return shelves.map((shelf): EstanteriaDesguace => {
    const occupied = locations.filter((row) => getShelfCode(row.ubicacion) === shelf.codigo).length;
    const fullByCapacity = occupied >= shelf.capacidad_maxima;
    const full = shelf.llena_manual || fullByCapacity;
    return {
      ...shelf,
      ocupados: occupied,
      disponibles: Math.max(0, shelf.capacidad_maxima - occupied),
      porcentaje_ocupacion: Math.min(100, Math.round((occupied / shelf.capacidad_maxima) * 100)),
      llena: full,
      motivo_llena: shelf.llena_manual ? "manual" : fullByCapacity ? "capacidad" : null,
      siguiente_ubicacion: full ? null : firstFreeLocation(shelf, occupiedLocations),
    };
  });
}

function normalize(value: string | null | undefined) {
  return (value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

export function suggestLocations(piece: PiezaParaSugerencia, shelves: EstanteriaDesguace[]) {
  const category = normalize(piece.categoria);
  const searchable = normalize([
    piece.nombre_pieza, piece.descripcion, piece.categoria, piece.marca_pieza,
    piece.marca_vehiculo, piece.modelo_vehiculo,
  ].filter(Boolean).join(" "));

  return shelves.filter((shelf) => shelf.activa && !shelf.llena && shelf.siguiente_ubicacion).flatMap((shelf) => {
    const categoryMatches = shelf.categorias.filter((item) => category && normalize(item) === category);
    const keywordMatches = shelf.palabras_clave.filter((item) => normalize(item) && searchable.includes(normalize(item)));
    const general = shelf.categorias.length === 0 && shelf.palabras_clave.length === 0;
    const score = categoryMatches.length * 100 + keywordMatches.length * 10 + (general ? 1 : 0);
    if (!score) return [];
    const reasons = [
      ...categoryMatches.map((item) => `Categoría: ${item}`),
      ...keywordMatches.map((item) => `Coincide con “${item}”`),
      ...(general ? ["Estantería general"] : []),
    ];
    return [{ estanteria: shelf, ubicacion: shelf.siguiente_ubicacion!, motivos: reasons, puntuacion: score } satisfies SugerenciaUbicacion];
  }).sort((left, right) => right.puntuacion - left.puntuacion || right.estanteria.disponibles - left.estanteria.disponibles);
}
