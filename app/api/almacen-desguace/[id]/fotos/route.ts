import { NextResponse } from "next/server";
import { getRequestUser } from "@/lib/auth";
import { getWarehouseSettings } from "@/lib/app-settings-server";
import { getPhotoCount, getPieza } from "@/lib/almacen-desguace-data";
import { protectAdminApiRequest, protectApiRequest } from "@/lib/request-security";
import { PHOTO_UPLOAD_MAX_BYTES } from "@/lib/photo-upload";
import { getSupabaseApiConfig, parseSupabaseResponse, supabaseHeaders, supabaseStorageHeaders } from "@/lib/supabase-rest";
import type { FotoDesguace } from "@/types/almacen-desguace";

type Context = { params: Promise<{ id: string }> };
const BUCKET = "almacen-desguace";

export async function POST(request: Request, context: Context) {
  const guard = await protectApiRequest(request, { keyPrefix: "desguace:photos", limit: 30, windowMs: 60_000 });
  if (guard) return guard;
  try {
    const { id } = await context.params;
    if (!(await getPieza(id))) return NextResponse.json({ error: "Pieza no encontrada." }, { status: 404 });
    const contentType = request.headers.get("content-type") || "";
    const signedUser = await getRequestUser(request);
    if (contentType.includes("application/json")) {
      if (signedUser?.rol !== "administrador") return NextResponse.json({ error: "Solo un administrador puede importar fotografías externas." }, { status: 403 });
      const body = await request.json() as { urls?: unknown };
      const urls = Array.isArray(body.urls)
        ? [...new Set(body.urls.map(String).map((value) => value.trim()).filter(isRemoteImageUrl))].slice(0, 20)
        : [];
      if (!urls.length) return NextResponse.json({ error: "No se recibieron fotografías válidas de Recambio Fácil." }, { status: 400 });
      const { url, key } = getSupabaseApiConfig();
      let count = await getPhotoCount(id);
      const created: FotoDesguace[] = [];
      for (const remoteUrl of urls) {
        const insert = await fetch(`${url}/rest/v1/almacen_desguace_fotos?select=*`, {
          method: "POST",
          headers: supabaseHeaders(key, { Prefer: "return=representation" }),
          body: JSON.stringify({ pieza_id: Number(id), url_imagen: remoteUrl, es_principal: count === 0, orden: count }),
        });
        const rows = await parseSupabaseResponse<FotoDesguace[]>(insert);
        created.push(rows[0]);
        count++;
      }
      return NextResponse.json(created, { status: 201 });
    }
    if (signedUser?.rol !== "administrador" && !(await getWarehouseSettings()).employeesCanUploadPhotos) return NextResponse.json({ error: "Un administrador ha desactivado la subida de fotos para empleados." }, { status: 403 });
    let files: File[];
    if (contentType.startsWith("image/")) {
      const declaredSize = Number(request.headers.get("content-length") || 0);
      if (declaredSize > PHOTO_UPLOAD_MAX_BYTES) {
        return NextResponse.json({ error: "La fotografía supera el máximo de 5 MB." }, { status: 413 });
      }
      const bytes = await request.arrayBuffer();
      if (!bytes.byteLength) return NextResponse.json({ error: "La fotografía llegó vacía." }, { status: 400 });
      if (bytes.byteLength > PHOTO_UPLOAD_MAX_BYTES) {
        return NextResponse.json({ error: "La fotografía supera el máximo de 5 MB." }, { status: 413 });
      }
      files = [new File([bytes], photoName(request.headers.get("x-photo-name")), { type: contentType.split(";", 1)[0] })];
    } else {
      try {
        const form = await request.formData();
        files = form.getAll("fotos").filter((item): item is File => item instanceof File);
      } catch {
        return NextResponse.json({ error: "No se pudo leer la fotografía. Vuelve a seleccionarla e inténtalo de nuevo." }, { status: 400 });
      }
    }
    if (!files.length) return NextResponse.json({ error: "Selecciona al menos una foto." }, { status: 400 });
    if (files.some((file) => !file.type.startsWith("image/") || file.size > PHOTO_UPLOAD_MAX_BYTES)) {
      return NextResponse.json({ error: "La fotografía debe ocupar como máximo 5 MB después de optimizarla." }, { status: 400 });
    }
    const { url, key } = getSupabaseApiConfig();
    let count = await getPhotoCount(id);
    const created: FotoDesguace[] = [];
    for (const file of files) {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-").slice(-100);
      const path = `${id}/${crypto.randomUUID()}-${safeName}`;
      const encoded = path.split("/").map(encodeURIComponent).join("/");
      const upload = await fetch(`${url}/storage/v1/object/${BUCKET}/${encoded}`, {
        method: "POST",
        headers: supabaseStorageHeaders(key, { "Content-Type": file.type, "x-upsert": "false" }),
        body: await file.arrayBuffer(),
      });
      if (!upload.ok) throw new Error((await upload.json().catch(() => null))?.message || "No se pudo subir la foto.");
      const insert = await fetch(`${url}/rest/v1/almacen_desguace_fotos?select=*`, {
        method: "POST", headers: supabaseHeaders(key, { Prefer: "return=representation" }),
        body: JSON.stringify({ pieza_id: Number(id), url_imagen: path, es_principal: count === 0, orden: count }),
      });
      const rows = await parseSupabaseResponse<FotoDesguace[]>(insert);
      created.push(rows[0]);
      count++;
    }
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudieron subir las fotos." }, { status: 500 });
  }
}

function isRemoteImageUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function photoName(value: string | null) {
  if (!value) return "fotografia.jpg";
  try { return decodeURIComponent(value); }
  catch { return "fotografia.jpg"; }
}

export async function PATCH(request: Request, context: Context) {
  const guard = await protectApiRequest(request, { keyPrefix: "desguace:photos-update", limit: 60, windowMs: 60_000 });
  if (guard) return guard;
  try {
    const { id } = await context.params;
    const signedUser = await getRequestUser(request);
    if (signedUser?.rol !== "administrador" && !(await getWarehouseSettings()).employeesCanChooseMainPhoto) return NextResponse.json({ error: "Solo un administrador puede cambiar la foto principal." }, { status: 403 });
    const body = await request.json() as { foto_id?: number; es_principal?: boolean; orden?: number };
    if (!body.foto_id) return NextResponse.json({ error: "Falta la fotografía." }, { status: 400 });
    const { url, key } = getSupabaseApiConfig();
    if (body.es_principal) {
      const unset = new URLSearchParams({ pieza_id: `eq.${id}` });
      const response = await fetch(`${url}/rest/v1/almacen_desguace_fotos?${unset}`, {
        method: "PATCH", headers: supabaseHeaders(key), body: JSON.stringify({ es_principal: false }),
      });
      if (!response.ok) throw new Error("No se pudo cambiar la foto principal.");
    }
    const params = new URLSearchParams({ id: `eq.${body.foto_id}`, pieza_id: `eq.${id}`, select: "*" });
    const response = await fetch(`${url}/rest/v1/almacen_desguace_fotos?${params}`, {
      method: "PATCH", headers: supabaseHeaders(key, { Prefer: "return=representation" }),
      body: JSON.stringify({ ...(body.es_principal !== undefined && { es_principal: body.es_principal }), ...(body.orden !== undefined && { orden: body.orden }) }),
    });
    const rows = await parseSupabaseResponse<FotoDesguace[]>(response);
    return NextResponse.json(rows[0]);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo actualizar la foto." }, { status: 500 });
  }
}

export async function DELETE(request: Request, context: Context) {
  const guard = await protectAdminApiRequest(request, { keyPrefix: "desguace:photos-delete", limit: 30, windowMs: 60_000 });
  if (guard) return guard;
  try {
    const { id } = await context.params;
    const fotoId = new URL(request.url).searchParams.get("foto_id");
    if (!fotoId) return NextResponse.json({ error: "Falta la fotografía." }, { status: 400 });
    const { url, key } = getSupabaseApiConfig();
    const selectParams = new URLSearchParams({ select: "*", id: `eq.${fotoId}`, pieza_id: `eq.${id}`, limit: "1" });
    const selected = await fetch(`${url}/rest/v1/almacen_desguace_fotos?${selectParams}`, { headers: supabaseHeaders(key) });
    const rows = await parseSupabaseResponse<FotoDesguace[]>(selected);
    const photo = rows[0];
    if (!photo) return NextResponse.json({ error: "Foto no encontrada." }, { status: 404 });
    const deleteParams = new URLSearchParams({ id: `eq.${fotoId}`, pieza_id: `eq.${id}` });
    const deleted = await fetch(`${url}/rest/v1/almacen_desguace_fotos?${deleteParams}`, { method: "DELETE", headers: supabaseHeaders(key) });
    if (!deleted.ok) throw new Error("No se pudo eliminar el registro de la foto.");
    if (!/^https?:\/\//i.test(photo.url_imagen)) {
      const encoded = photo.url_imagen.split("/").map(encodeURIComponent).join("/");
      await fetch(`${url}/storage/v1/object/${BUCKET}/${encoded}`, { method: "DELETE", headers: supabaseStorageHeaders(key) });
    }
    if (photo.es_principal) {
      const remaining = await getPieza(id);
      const next = remaining?.fotos?.sort((a, b) => a.orden - b.orden)[0];
      if (next) {
        const params = new URLSearchParams({ id: `eq.${next.id}` });
        await fetch(`${url}/rest/v1/almacen_desguace_fotos?${params}`, { method: "PATCH", headers: supabaseHeaders(key), body: JSON.stringify({ es_principal: true }) });
      }
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo eliminar la foto." }, { status: 500 });
  }
}
