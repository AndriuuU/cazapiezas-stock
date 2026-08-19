import { NextResponse } from "next/server";
import { normalizeWarehouseSettings } from "@/lib/app-settings";
import { getWarehouseSettings } from "@/lib/app-settings-server";
import { protectAdminApiRequest, protectApiRequest } from "@/lib/request-security";
import { getSupabaseApiConfig, parseSupabaseResponse, supabaseHeaders } from "@/lib/supabase-rest";

type ConfigRow = { valor: unknown };

export async function GET(request: Request) {
  const guard = await protectApiRequest(request, { keyPrefix: "settings:warehouse:get", limit: 100, windowMs: 60_000 });
  if (guard) return guard;
  return NextResponse.json({ settings: await getWarehouseSettings() });
}

export async function PATCH(request: Request) {
  const guard = await protectAdminApiRequest(request, { keyPrefix: "settings:warehouse:update", limit: 30, windowMs: 60_000 });
  if (guard) return guard;
  try {
    const settings = normalizeWarehouseSettings(await request.json());
    const { url, key } = getSupabaseApiConfig();
    const response = await fetch(`${url}/rest/v1/cazapiezas_configuracion?on_conflict=clave&select=valor`, {
      method: "POST",
      headers: supabaseHeaders(key, { Prefer: "resolution=merge-duplicates,return=representation" }),
      body: JSON.stringify({ clave: "almacen_desguace", valor: settings, updated_at: new Date().toISOString() }),
    });
    const row = (await parseSupabaseResponse<ConfigRow[]>(response))[0];
    return NextResponse.json({ settings: normalizeWarehouseSettings(row?.valor) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo guardar la configuración." }, { status: 500 });
  }
}
