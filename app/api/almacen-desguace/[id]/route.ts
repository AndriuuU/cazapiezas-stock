import { NextResponse } from "next/server";
import {
  normalizePiezaInput, requiresPublishValidation, validatePieza, validateReadyToPublish,
} from "@/lib/almacen-desguace";
import { getPhotoCount, getPieza, withPublicPhotos } from "@/lib/almacen-desguace-data";
import { protectApiRequest } from "@/lib/request-security";
import { getSupabaseApiConfig, parseSupabaseResponse, supabaseHeaders } from "@/lib/supabase-rest";
import type { PiezaDesguace, PiezaDesguaceInput } from "@/types/almacen-desguace";

type Context = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: Context) {
  const guard = await protectApiRequest(request, { keyPrefix: "desguace:detail", limit: 100, windowMs: 60_000 });
  if (guard) return guard;
  try {
    const { id } = await context.params;
    const pieza = await getPieza(id);
    if (!pieza) return NextResponse.json({ error: "Pieza no encontrada." }, { status: 404 });
    return NextResponse.json(await withPublicPhotos(pieza));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo cargar la pieza." }, { status: 500 });
  }
}

function actionPatch(action: unknown): PiezaDesguaceInput {
  if (action === "publicar") return { estado_proceso: "Publicada", publicado_online: true };
  if (action === "reservar") return { estado_proceso: "Reservada" };
  if (action === "vender") return { estado_proceso: "Vendida" };
  if (action === "enviar") return { estado_proceso: "Enviada" };
  if (action === "retirar") return { estado_proceso: "Retirada", publicado_online: false };
  return {};
}

export async function PATCH(request: Request, context: Context) {
  const guard = await protectApiRequest(request, { keyPrefix: "desguace:update", limit: 60, windowMs: 60_000 });
  if (guard) return guard;
  try {
    const { id } = await context.params;
    const current = await getPieza(id);
    if (!current) return NextResponse.json({ error: "Pieza no encontrada." }, { status: 404 });
    const raw = await request.json() as Record<string, unknown>;
    const patch = { ...normalizePiezaInput(raw), ...actionPatch(raw.action) };
    const errors = validatePieza(patch);
    if (errors.length) return NextResponse.json({ error: errors.join(" ") }, { status: 400 });
    const merged = { ...current, ...patch };
    if (requiresPublishValidation(merged.estado_proceso)) {
      const missing = validateReadyToPublish(merged, await getPhotoCount(id));
      if (missing.length) return NextResponse.json({ error: `Para publicar faltan: ${missing.join(", ")}.` }, { status: 400 });
    }
    if (requiresPublishValidation(merged.estado_proceso) && !merged.ubicacion) {
      return NextResponse.json({ error: "Una pieza disponible debe tener ubicación." }, { status: 400 });
    }
    const { url, key } = getSupabaseApiConfig();
    const params = new URLSearchParams({ id: `eq.${id}`, select: "*" });
    const response = await fetch(`${url}/rest/v1/almacen_desguace_piezas?${params}`, {
      method: "PATCH", headers: supabaseHeaders(key, { Prefer: "return=representation" }), body: JSON.stringify(patch),
    });
    const rows = await parseSupabaseResponse<PiezaDesguace[]>(response);
    return NextResponse.json(rows[0]);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo actualizar la pieza." }, { status: 500 });
  }
}
