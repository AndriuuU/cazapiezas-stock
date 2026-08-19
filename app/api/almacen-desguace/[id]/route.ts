import { NextResponse } from "next/server";
import { getRequestUser } from "@/lib/auth";
import { normalizePiezaInput, validatePieza } from "@/lib/almacen-desguace";
import { getPieza, withPublicPhotos } from "@/lib/almacen-desguace-data";
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
  if (action === "reservar") return { estado_proceso: "Reservada" };
  if (action === "enviar") return { estado_proceso: "Enviada" };
  if (action === "retirar") return { estado_proceso: "Retirada", publicado_online: false, ubicacion: null, cajon_id: null };
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
    const signedUser = await getRequestUser(request);
    if (signedUser?.rol !== "administrador" && raw.action !== "reservar" && raw.action !== "enviar") return NextResponse.json({ error: "Solo un administrador puede editar o retirar piezas." }, { status: 403 });
    if (raw.action === "publicar") return NextResponse.json({ error: "Usa la publicación de Recambio Fácil para marcar una pieza como Online." }, { status: 400 });
    const normalized = normalizePiezaInput(raw);
    if (raw.action === "vender" || normalized.estado_proceso === "Vendida") return NextResponse.json({ error: "Usa Registrar venta para indicar fecha, empleado y precio final." }, { status: 400 });
    delete normalized.publicado_online;
    const patch = { ...normalized, ...actionPatch(raw.action) };
    if (patch.estado_proceso === "Publicada") Object.assign(patch, { publicado_online: true });
    if (patch.estado_proceso === "Retirada" || patch.estado_proceso === "Vendida") Object.assign(patch, { publicado_online: false, ubicacion: null, cajon_id: null });
    const errors = validatePieza(patch);
    if (errors.length) return NextResponse.json({ error: errors.join(" ") }, { status: 400 });
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
