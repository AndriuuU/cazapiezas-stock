import "server-only";

import { DEFAULT_WAREHOUSE_SETTINGS, normalizeWarehouseSettings, type WarehouseSettings } from "@/lib/app-settings";
import { getSupabaseApiConfig, parseSupabaseResponse, supabaseHeaders } from "@/lib/supabase-rest";

type ConfigRow = { valor: unknown };

export async function getWarehouseSettings(): Promise<WarehouseSettings> {
  try {
    const { url, key } = getSupabaseApiConfig();
    const response = await fetch(`${url}/rest/v1/cazapiezas_configuracion?select=valor&clave=eq.almacen_desguace&limit=1`, {
      headers: supabaseHeaders(key),
      cache: "no-store",
    });
    if (!response.ok) return DEFAULT_WAREHOUSE_SETTINGS;
    const row = (await parseSupabaseResponse<ConfigRow[]>(response))[0];
    return normalizeWarehouseSettings(row?.valor);
  } catch {
    return DEFAULT_WAREHOUSE_SETTINGS;
  }
}
