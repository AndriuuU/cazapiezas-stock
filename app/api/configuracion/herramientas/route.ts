import { NextResponse } from "next/server";
import { DEFAULT_TOOL_SETTINGS, normalizeToolSettings } from "@/lib/app-settings";
import { protectAdminApiRequest, protectApiRequest } from "@/lib/request-security";
import { getSupabaseApiConfig, parseSupabaseResponse, supabaseHeaders } from "@/lib/supabase-rest";

type ConfigRow = { valor: unknown };

export async function GET(request: Request) {
  const guard = await protectApiRequest(request, { keyPrefix: "settings:tools:get", limit: 100, windowMs: 60_000 });
  if (guard) return guard;
  try {
    const { url, key } = getSupabaseApiConfig();
    const response = await fetch(`${url}/rest/v1/cazapiezas_configuracion?select=valor&clave=eq.herramientas&limit=1`, { headers: supabaseHeaders(key), cache: "no-store" });
    if (!response.ok) return NextResponse.json({ settings: DEFAULT_TOOL_SETTINGS, setupRequired: true });
    const row = (await parseSupabaseResponse<ConfigRow[]>(response))[0];
    return NextResponse.json({ settings: normalizeToolSettings(row?.valor) });
  } catch { return NextResponse.json({ settings: DEFAULT_TOOL_SETTINGS, setupRequired: true }); }
}

export async function PATCH(request: Request) {
  const guard = await protectAdminApiRequest(request, { keyPrefix: "settings:tools:update", limit: 30, windowMs: 60_000 });
  if (guard) return guard;
  try {
    const settings = normalizeToolSettings(await request.json());
    const { url, key } = getSupabaseApiConfig();
    const response = await fetch(`${url}/rest/v1/cazapiezas_configuracion?on_conflict=clave&select=valor`, { method: "POST", headers: supabaseHeaders(key, { Prefer: "resolution=merge-duplicates,return=representation" }), body: JSON.stringify({ clave: "herramientas", valor: settings, updated_at: new Date().toISOString() }) });
    const row = (await parseSupabaseResponse<ConfigRow[]>(response))[0];
    return NextResponse.json({ settings: normalizeToolSettings(row?.valor) });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo guardar la configuración." }, { status: 500 }); }
}
