import { NextResponse } from "next/server";
import { PHOTO_UPLOAD_MAX_BYTES } from "@/lib/photo-upload";
import { protectApiRequest } from "@/lib/request-security";
import { getSupabaseApiConfig, parseSupabaseResponse, supabaseHeaders, supabaseStorageHeaders } from "@/lib/supabase-rest";

type Context = { params: Promise<{ id: string; movementId: string }> };
const BUCKET = "almacen-desguace";

export async function POST(request: Request, context: Context) {
  const guard = await protectApiRequest(request, { keyPrefix: "common-tools:incident-photo", limit: 20, windowMs: 60_000 });
  if (guard) return guard;
  try {
    const { id, movementId } = await context.params;
    if (!/^\d+$/.test(id) || !/^\d+$/.test(movementId)) return NextResponse.json({ error: "Incidencia no válida." }, { status: 400 });
    const contentType = (request.headers.get("content-type") || "").split(";", 1)[0];
    const declaredSize = Number(request.headers.get("content-length") || 0);
    if (!contentType.startsWith("image/") || declaredSize > PHOTO_UPLOAD_MAX_BYTES) return NextResponse.json({ error: "La fotografía debe ser una imagen de hasta 5 MB." }, { status: 413 });
    const bytes = await request.arrayBuffer();
    if (!bytes.byteLength || bytes.byteLength > PHOTO_UPLOAD_MAX_BYTES) return NextResponse.json({ error: "La fotografía está vacía o supera los 5 MB." }, { status: 413 });
    const { url, key } = getSupabaseApiConfig();
    const movementParams = new URLSearchParams({ select: "id,foto_url", id: `eq.${movementId}`, herramienta_id: `eq.${id}`, tipo: "eq.incidencia", limit: "1" });
    const movementResponse = await fetch(`${url}/rest/v1/herramientas_comunes_movimientos?${movementParams}`, { headers: supabaseHeaders(key), cache: "no-store" });
    const movement = (await parseSupabaseResponse<Array<{ id: number; foto_url: string | null }>>(movementResponse))[0];
    if (!movement) return NextResponse.json({ error: "No se encontró la incidencia." }, { status: 404 });
    if (movement.foto_url) return NextResponse.json({ error: "Esta incidencia ya tiene una fotografía asociada." }, { status: 409 });
    const path = `herramientas-comunes/${id}/incidencias/${movementId}-${crypto.randomUUID()}.jpg`;
    const encoded = path.split("/").map(encodeURIComponent).join("/");
    const upload = await fetch(`${url}/storage/v1/object/${BUCKET}/${encoded}`, { method: "POST", headers: supabaseStorageHeaders(key, { "Content-Type": contentType, "x-upsert": "false" }), body: bytes });
    if (!upload.ok) throw new Error((await upload.json().catch(() => null))?.message || "No se pudo guardar la fotografía.");
    const publicUrl = `${url}/storage/v1/object/public/${BUCKET}/${encoded}`;
    const update = await fetch(`${url}/rest/v1/rpc/herramientas_comunes_asociar_foto_incidencia`, {
      method: "POST",
      headers: supabaseHeaders(key),
      body: JSON.stringify({ p_herramienta_id: Number(id), p_movimiento_id: Number(movementId), p_foto_url: publicUrl, p_storage_path: path }),
    });
    const associated = update.ok ? await update.json() as boolean : false;
    if (!associated) {
      await fetch(`${url}/storage/v1/object/${BUCKET}/${encoded}`, { method: "DELETE", headers: supabaseStorageHeaders(key) });
      if (!update.ok) {
        const payload = await update.json().catch(() => null) as { message?: string; error?: string; code?: string } | null;
        const missingUpdate = update.status === 404 || payload?.code === "PGRST202";
        return NextResponse.json({ error: missingUpdate ? "Falta aplicar la actualización 202608240001_control_herramientas_comunes.sql." : payload?.message || payload?.error || "No se pudo asociar la foto a la incidencia." }, { status: missingUpdate ? 503 : 409 });
      }
      return NextResponse.json({ error: "Esta incidencia ya tiene una fotografía asociada." }, { status: 409 });
    }
    return NextResponse.json({ foto_url: publicUrl });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo guardar la foto de la incidencia." }, { status: 500 });
  }
}
