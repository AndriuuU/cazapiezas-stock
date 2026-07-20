import "server-only";

import { getSupabaseApiConfig, parseSupabaseResponse, supabaseHeaders } from "@/lib/supabase-rest";
import type { MovimientoUbicacion } from "@/types/almacen-desguace";

export async function getLocationHistory(options: { pieceId?: string | number; limit?: number } = {}) {
  const { url, key } = getSupabaseApiConfig();
  const params = new URLSearchParams({
    select: "*,pieza:almacen_desguace_piezas(id,codigo_interno,nombre_pieza),estanteria_sugerida:almacen_desguace_estanterias(id,codigo,nombre,zona)",
    order: "created_at.desc",
    limit: String(Math.min(1000, Math.max(1, options.limit || 300))),
  });
  if (options.pieceId !== undefined) params.set("pieza_id", `eq.${options.pieceId}`);

  const response = await fetch(`${url}/rest/v1/almacen_desguace_ubicaciones_movimientos?${params}`, {
    headers: supabaseHeaders(key),
    cache: "no-store",
  });
  return parseSupabaseResponse<MovimientoUbicacion[]>(response);
}
