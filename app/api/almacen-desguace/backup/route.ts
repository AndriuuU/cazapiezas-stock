import { NextResponse } from "next/server";
import { protectApiRequest } from "@/lib/request-security";
import { getSupabaseApiConfig, parseSupabaseResponse, supabaseHeaders } from "@/lib/supabase-rest";

async function readTable(url: string, key: string, table: string) {
  const params = new URLSearchParams({ select: "*", limit: "10000" });
  const response = await fetch(`${url}/rest/v1/${table}?${params}`, { headers: supabaseHeaders(key), cache: "no-store" });
  return parseSupabaseResponse<unknown[]>(response);
}

export async function GET(request: Request) {
  const guard = await protectApiRequest(request, { keyPrefix: "desguace:backup", limit: 5, windowMs: 60_000 });
  if (guard) return guard;
  try {
    const { url, key } = getSupabaseApiConfig();
    const [pieces, photos, drawers, locationMovements, drawerMovements, events] = await Promise.all([
      readTable(url, key, "almacen_desguace_piezas"),
      readTable(url, key, "almacen_desguace_fotos"),
      readTable(url, key, "almacen_desguace_cajones"),
      readTable(url, key, "almacen_desguace_ubicaciones_movimientos"),
      readTable(url, key, "almacen_desguace_cajones_movimientos"),
      readTable(url, key, "almacen_desguace_eventos"),
    ]);
    const generatedAt = new Date().toISOString();
    const date = generatedAt.slice(0, 10);
    return new NextResponse(JSON.stringify({ version: 1, generatedAt, pieces, photos, drawers, locationMovements, drawerMovements, events }, null, 2), {
      headers: { "Content-Type": "application/json; charset=utf-8", "Content-Disposition": `attachment; filename="copia-almacen-${date}.json"`, "Cache-Control": "no-store" },
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo crear la copia de seguridad." }, { status: 500 });
  }
}
