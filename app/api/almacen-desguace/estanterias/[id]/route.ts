import { NextResponse } from "next/server";
import { normalizeShelf, validateShelf } from "@/lib/almacen-desguace-estanterias-input";
import { protectAdminApiRequest } from "@/lib/request-security";
import { getSupabaseApiConfig, parseSupabaseResponse, supabaseHeaders } from "@/lib/supabase-rest";

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: Context) {
  const guard = await protectAdminApiRequest(request, { keyPrefix: "desguace:shelves-update", limit: 60, windowMs: 60_000 });
  if (guard) return guard;
  try {
    const { id } = await context.params;
    const shelf = normalizeShelf(await request.json());
    const errors = validateShelf(shelf);
    if (errors.length) return NextResponse.json({ error: errors.join(" ") }, { status: 400 });
    const { url, key } = getSupabaseApiConfig();
    const params = new URLSearchParams({ id: `eq.${id}`, select: "*" });
    const response = await fetch(`${url}/rest/v1/almacen_desguace_estanterias?${params}`, {
      method: "PATCH", headers: supabaseHeaders(key, { Prefer: "return=representation" }), body: JSON.stringify(shelf),
    });
    const rows = await parseSupabaseResponse<unknown[]>(response);
    if (!rows.length) return NextResponse.json({ error: "Estantería no encontrada." }, { status: 404 });
    return NextResponse.json(rows[0]);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo actualizar la estantería." }, { status: 500 });
  }
}
