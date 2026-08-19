import { NextResponse } from "next/server";
import { getShelves } from "@/lib/almacen-desguace-estanterias";
import { normalizeShelf, validateShelf } from "@/lib/almacen-desguace-estanterias-input";
import { protectAdminApiRequest, protectApiRequest } from "@/lib/request-security";
import { getSupabaseApiConfig, parseSupabaseResponse, supabaseHeaders } from "@/lib/supabase-rest";


export async function GET(request: Request) {
  const guard = await protectApiRequest(request, { keyPrefix: "desguace:shelves", limit: 100, windowMs: 60_000 });
  if (guard) return guard;
  try {
    return NextResponse.json(await getShelves());
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudieron cargar las estanterías." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const guard = await protectAdminApiRequest(request, { keyPrefix: "desguace:shelves-create", limit: 30, windowMs: 60_000 });
  if (guard) return guard;
  try {
    const shelf = normalizeShelf(await request.json());
    const errors = validateShelf(shelf);
    if (errors.length) return NextResponse.json({ error: errors.join(" ") }, { status: 400 });
    const { url, key } = getSupabaseApiConfig();
    const response = await fetch(`${url}/rest/v1/almacen_desguace_estanterias?select=*`, {
      method: "POST", headers: supabaseHeaders(key, { Prefer: "return=representation" }), body: JSON.stringify(shelf),
    });
    const rows = await parseSupabaseResponse<unknown[]>(response);
    return NextResponse.json(rows[0], { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo crear la estantería." }, { status: 500 });
  }
}
