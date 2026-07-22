import { NextResponse } from "next/server";
import {
  normalizePiezaInput,
  requiresPublishValidation,
  validatePieza,
  validateReadyToPublish,
} from "@/lib/almacen-desguace";
import { protectApiRequest } from "@/lib/request-security";
import { getSupabaseApiConfig, parseSupabaseResponse, supabaseHeaders } from "@/lib/supabase-rest";
import type { PiezaDesguace, PiezaDesguaceInput } from "@/types/almacen-desguace";

const ALLOWED_FIELDS = ["estado_pieza", "estado_proceso", "ubicacion"] as const;

export async function PATCH(request: Request) {
  const guard = await protectApiRequest(request, {
    keyPrefix: "desguace:bulk-update",
    limit: 20,
    windowMs: 60_000,
  });
  if (guard) return guard;

  try {
    const body = await request.json() as { ids?: unknown; changes?: unknown };
    const ids = Array.isArray(body.ids)
      ? [...new Set(body.ids.map(Number).filter((id) => Number.isInteger(id) && id > 0))]
      : [];
    if (!ids.length) return NextResponse.json({ error: "Selecciona al menos una pieza." }, { status: 400 });
    if (ids.length > 1000) return NextResponse.json({ error: "Solo se pueden modificar 1.000 piezas por operación." }, { status: 400 });

    const normalized = normalizePiezaInput(body.changes);
    const changes = Object.fromEntries(
      ALLOWED_FIELDS.filter((field) => field in normalized).map((field) => [field, normalized[field]])
    ) as PiezaDesguaceInput;
    if (!Object.keys(changes).length) return NextResponse.json({ error: "Elige el cambio que quieres aplicar." }, { status: 400 });
    if (changes.estado_proceso === "Retirada" || changes.estado_proceso === "Vendida") Object.assign(changes, { publicado_online: false, ubicacion: null, cajon_id: null });
    const errors = validatePieza(changes);
    if (errors.length) return NextResponse.json({ error: errors.join(" ") }, { status: 400 });

    const { url, key } = getSupabaseApiConfig();
    const idsFilter = `in.(${ids.join(",")})`;
    const selectParams = new URLSearchParams({
      select: "*,fotos:almacen_desguace_fotos(id)",
      id: idsFilter,
      limit: "1000",
    });
    const selectedResponse = await fetch(`${url}/rest/v1/almacen_desguace_piezas?${selectParams}`, {
      headers: supabaseHeaders(key), cache: "no-store",
    });
    const pieces = await parseSupabaseResponse<PiezaDesguace[]>(selectedResponse);
    if (pieces.length !== ids.length) return NextResponse.json({ error: "Alguna pieza seleccionada ya no existe. Actualiza el listado." }, { status: 409 });

    const invalid = pieces.flatMap((piece) => {
      const merged = { ...piece, ...changes };
      if (!requiresPublishValidation(merged.estado_proceso)) return [];
      const missing = validateReadyToPublish(merged, piece.fotos?.length || 0);
      return missing.length ? [`${piece.codigo_interno}: ${missing.join(", ")}`] : [];
    });
    if (invalid.length) {
      return NextResponse.json({
        error: `No se puede aplicar el cambio. Revisa: ${invalid.slice(0, 8).join("; ")}${invalid.length > 8 ? ` y ${invalid.length - 8} más` : ""}.`,
      }, { status: 400 });
    }

    const updateParams = new URLSearchParams({ id: idsFilter, select: "*" });
    const updateResponse = await fetch(`${url}/rest/v1/almacen_desguace_piezas?${updateParams}`, {
      method: "PATCH",
      headers: supabaseHeaders(key, { Prefer: "return=representation" }),
      body: JSON.stringify(changes),
    });
    const updated = await parseSupabaseResponse<PiezaDesguace[]>(updateResponse);
    return NextResponse.json({ count: updated.length, updated });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo realizar la modificación masiva." }, { status: 500 });
  }
}
