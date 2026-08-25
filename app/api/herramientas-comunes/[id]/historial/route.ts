import { NextResponse } from "next/server";
import { protectApiRequest } from "@/lib/request-security";
import { getSupabaseApiConfig, parseSupabaseResponse, supabaseHeaders } from "@/lib/supabase-rest";
import type { MovimientoHerramienta } from "@/types/herramientas-comunes";

type Context = { params: Promise<{ id: string }> };
const PAGE_SIZE = 40;

export async function GET(request: Request, context: Context) {
  const guard = await protectApiRequest(request, { keyPrefix: "common-tools:history", limit: 100, windowMs: 60_000 });
  if (guard) return guard;
  try {
    const { id } = await context.params;
    if (!/^\d+$/.test(id)) return NextResponse.json({ error: "Herramienta no válida." }, { status: 400 });
    const beforeId = new URL(request.url).searchParams.get("before_id");
    if (beforeId && !/^\d+$/.test(beforeId)) return NextResponse.json({ error: "Cursor de historial no válido." }, { status: 400 });
    const params = new URLSearchParams({ select: "*", herramienta_id: `eq.${id}`, order: "id.desc", limit: String(PAGE_SIZE + 1) });
    if (beforeId) params.set("id", `lt.${beforeId}`);
    const { url, key } = getSupabaseApiConfig();
    const response = await fetch(`${url}/rest/v1/herramientas_comunes_movimientos?${params}`, { headers: supabaseHeaders(key), cache: "no-store" });
    const rows = await parseSupabaseResponse<MovimientoHerramienta[]>(response);
    const hasMore = rows.length > PAGE_SIZE;
    const movements = rows.slice(0, PAGE_SIZE);
    return NextResponse.json({ movements, nextBeforeId: hasMore ? movements.at(-1)?.id || null : null }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo cargar el historial." }, { status: 500 });
  }
}
