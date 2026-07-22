import { NextResponse } from "next/server";
import { protectApiRequest } from "@/lib/request-security";
import { getSupabaseApiConfig, parseSupabaseResponse, supabaseHeaders } from "@/lib/supabase-rest";

function normalizeIds(value: unknown) {
  return Array.isArray(value)
    ? [...new Set(value.map(Number).filter((id) => Number.isInteger(id) && id > 0))]
    : [];
}

export async function POST(request: Request) {
  const guard = await protectApiRequest(request, { keyPrefix: "desguace:rf-confirm-online", limit: 20, windowMs: 60_000 });
  if (guard) return guard;

  try {
    const body = await request.json() as { ids?: unknown };
    const ids = normalizeIds(body.ids);
    if (!ids.length) return NextResponse.json({ error: "Selecciona al menos una pieza." }, { status: 400 });
    if (ids.length > 1000) return NextResponse.json({ error: "Solo se pueden confirmar 1.000 piezas por operación." }, { status: 400 });

    const { url, key } = getSupabaseApiConfig();
    const params = new URLSearchParams({ id: `in.(${ids.join(",")})`, select: "id" });
    const response = await fetch(`${url}/rest/v1/almacen_desguace_piezas?${params}`, {
      method: "PATCH",
      headers: supabaseHeaders(key, { Prefer: "return=representation" }),
      body: JSON.stringify({ publicado_online: true }),
    });
    const updated = await parseSupabaseResponse<Array<{ id: number }>>(response);
    if (updated.length !== ids.length) {
      return NextResponse.json({ error: "Alguna pieza ya no existe. Actualiza el listado y vuelve a intentarlo." }, { status: 409 });
    }
    return NextResponse.json({ count: updated.length });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo confirmar el estado Online." }, { status: 500 });
  }
}
