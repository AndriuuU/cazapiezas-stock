import { NextResponse } from "next/server";
import { getRequestUser } from "@/lib/auth";
import { protectAdminApiRequest } from "@/lib/request-security";
import { getSupabaseApiConfig, parseSupabaseResponse, supabaseHeaders } from "@/lib/supabase-rest";
import type { InventarioHerramientaItem, InventarioHerramientas } from "@/types/herramientas-comunes";

const SETUP_ERROR = "Falta aplicar la actualización 202609020002_herramientas_inventarios.sql.";

export async function GET(request: Request) {
  const guard = await protectAdminApiRequest(request, { keyPrefix: "common-tools:inventories:list", limit: 60, windowMs: 60_000 });
  if (guard) return guard;
  try {
    const { url, key } = getSupabaseApiConfig();
    const [historyResponse, activeResponse] = await Promise.all([
      fetch(`${url}/rest/v1/herramientas_comunes_inventarios?select=*&order=id.desc&limit=8`, { headers: supabaseHeaders(key), cache: "no-store" }),
      fetch(`${url}/rest/v1/herramientas_comunes_inventarios?select=*&estado=eq.abierto&order=id.desc&limit=1`, { headers: supabaseHeaders(key), cache: "no-store" }),
    ]);
    if (!historyResponse.ok || !activeResponse.ok) return NextResponse.json({ error: SETUP_ERROR }, { status: 503 });
    const [inventories, activeRows] = await Promise.all([
      parseSupabaseResponse<InventarioHerramientas[]>(historyResponse),
      parseSupabaseResponse<InventarioHerramientas[]>(activeResponse),
    ]);
    const active = activeRows[0] || null;
    if (active) {
      const itemsResponse = await fetch(`${url}/rest/v1/herramientas_comunes_inventario_items?select=*&inventario_id=eq.${active.id}&order=resultado.desc,nombre.asc`, { headers: supabaseHeaders(key), cache: "no-store" });
      if (!itemsResponse.ok) return NextResponse.json({ error: SETUP_ERROR }, { status: 503 });
      active.items = await parseSupabaseResponse<InventarioHerramientaItem[]>(itemsResponse);
    }
    return NextResponse.json({ active, inventories }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudieron cargar los inventarios." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const guard = await protectAdminApiRequest(request, { keyPrefix: "common-tools:inventories:start", limit: 10, windowMs: 60_000 });
  if (guard) return guard;
  try {
    const user = await getRequestUser(request);
    const { url, key } = getSupabaseApiConfig();
    const response = await fetch(`${url}/rest/v1/rpc/herramientas_comunes_iniciar_inventario`, {
      method: "POST", headers: supabaseHeaders(key), body: JSON.stringify({ p_empleado: user?.nombre || "Administrador" }),
    });
    if (!response.ok) return NextResponse.json({ error: response.status === 404 ? SETUP_ERROR : "No se pudo iniciar el inventario." }, { status: response.status === 404 ? 503 : 409 });
    return NextResponse.json(await response.json(), { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo iniciar el inventario." }, { status: 500 });
  }
}
