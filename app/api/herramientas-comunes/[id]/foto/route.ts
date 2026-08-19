import { NextResponse } from "next/server";
import { protectAdminApiRequest } from "@/lib/request-security";
import { PHOTO_UPLOAD_MAX_BYTES } from "@/lib/photo-upload";
import { getSupabaseApiConfig, parseSupabaseResponse, supabaseHeaders, supabaseStorageHeaders } from "@/lib/supabase-rest";
import type { HerramientaComun } from "@/types/herramientas-comunes";

type Context = { params: Promise<{ id: string }> };
const BUCKET = "almacen-desguace";

export async function POST(request: Request, context: Context) {
  const guard = await protectAdminApiRequest(request, { keyPrefix: "common-tools:photo", limit: 30, windowMs: 60_000 });
  if (guard) return guard;
  try {
    const { id } = await context.params;
    if (!/^\d+$/.test(id)) return NextResponse.json({ error: "Herramienta no válida." }, { status: 400 });
    const contentType = (request.headers.get("content-type") || "").split(";", 1)[0];
    const declaredSize = Number(request.headers.get("content-length") || 0);
    if (!contentType.startsWith("image/") || declaredSize > PHOTO_UPLOAD_MAX_BYTES) return NextResponse.json({ error: "La fotografía debe ser una imagen de hasta 5 MB." }, { status: 413 });
    const bytes = await request.arrayBuffer();
    if (!bytes.byteLength || bytes.byteLength > PHOTO_UPLOAD_MAX_BYTES) return NextResponse.json({ error: "La fotografía está vacía o supera los 5 MB." }, { status: 413 });
    const { url, key } = getSupabaseApiConfig();
    const toolParams = new URLSearchParams({ select: "id,foto_url", id: `eq.${id}`, limit: "1" });
    const toolResponse = await fetch(`${url}/rest/v1/herramientas_comunes_herramientas?${toolParams}`, { headers: supabaseHeaders(key) });
    const currentTool = (await parseSupabaseResponse<Array<{ id: number; foto_url: string | null }>>(toolResponse))[0];
    if (!currentTool) return NextResponse.json({ error: "Herramienta no encontrada." }, { status: 404 });
    const historyParams = new URLSearchParams({ select: "id", herramienta_id: `eq.${id}`, order: "created_at.asc" });
    const historyResponse = await fetch(`${url}/rest/v1/herramientas_comunes_fotos?${historyParams}`, { headers: supabaseHeaders(key) });
    const historyReady = historyResponse.ok;
    const existingPhotos = historyReady ? await parseSupabaseResponse<Array<{ id: number }>>(historyResponse) : [];
    if (!historyReady && currentTool.foto_url) return NextResponse.json({ error: "Activa primero la actualización segura de fotografías para no perder la foto inicial." }, { status: 503 });
    const rawName = request.headers.get("x-photo-name") || "foto-inicial.jpg";
    let decodedName = "foto-inicial.jpg";
    try { decodedName = decodeURIComponent(rawName); } catch { /* Conserva el nombre seguro predeterminado. */ }
    const safeName = decodedName.replace(/[^a-zA-Z0-9._-]/g, "-").slice(-100);
    const path = `herramientas-comunes/${id}/${crypto.randomUUID()}-${safeName}`;
    const encoded = path.split("/").map(encodeURIComponent).join("/");
    const upload = await fetch(`${url}/storage/v1/object/${BUCKET}/${encoded}`, { method: "POST", headers: supabaseStorageHeaders(key, { "Content-Type": contentType, "x-upsert": "false" }), body: bytes });
    if (!upload.ok) throw new Error((await upload.json().catch(() => null))?.message || "No se pudo guardar la fotografía.");
    const publicUrl = `${url}/storage/v1/object/public/${BUCKET}/${encoded}`;
    let photoHistoryId: number | null = null;
    if (historyReady) {
      const historyInsert = await fetch(`${url}/rest/v1/herramientas_comunes_fotos?select=id`, {
        method: "POST",
        headers: supabaseHeaders(key, { Prefer: "return=representation" }),
        body: JSON.stringify({ herramienta_id: Number(id), url: publicUrl, storage_path: path, tipo: existingPhotos.length ? "actualizacion" : "inicial" }),
      });
      if (!historyInsert.ok) {
        await fetch(`${url}/storage/v1/object/${BUCKET}/${encoded}`, { method: "DELETE", headers: supabaseStorageHeaders(key) });
        throw new Error("No se pudo guardar el historial de fotografías.");
      }
      photoHistoryId = (await parseSupabaseResponse<Array<{ id: number }>>(historyInsert))[0]?.id || null;
    }
    const updateParams = new URLSearchParams({ id: `eq.${id}`, select: "*" });
    const update = await fetch(`${url}/rest/v1/herramientas_comunes_herramientas?${updateParams}`, { method: "PATCH", headers: supabaseHeaders(key, { Prefer: "return=representation" }), body: JSON.stringify({ foto_url: publicUrl }) });
    if (!update.ok) {
      if (photoHistoryId) await fetch(`${url}/rest/v1/herramientas_comunes_fotos?id=eq.${photoHistoryId}`, { method: "DELETE", headers: supabaseHeaders(key) });
      await fetch(`${url}/storage/v1/object/${BUCKET}/${encoded}`, { method: "DELETE", headers: supabaseStorageHeaders(key) });
      throw new Error("La foto se subió, pero no se pudo asociar a la herramienta.");
    }
    const updated = (await parseSupabaseResponse<HerramientaComun[]>(update))[0];
    return NextResponse.json(updated);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo guardar la fotografía inicial." }, { status: 500 });
  }
}
