import type { FotoDesguace, PiezaDesguace } from "@/types/almacen-desguace";
import { getSupabaseApiConfig, parseSupabaseResponse, supabaseHeaders } from "@/lib/supabase-rest";

export async function getPieza(id: string | number) {
  const { url, key } = getSupabaseApiConfig();
  const params = new URLSearchParams({
    select: "*,fotos:almacen_desguace_fotos(*),cajon:almacen_desguace_cajones(id,codigo,nombre,ubicacion),iam:almacen_desguace_piezas_iam(*)",
    id: `eq.${id}`,
    limit: "1",
  });
  let response = await fetch(`${url}/rest/v1/almacen_desguace_piezas?${params}`, {
    headers: supabaseHeaders(key),
    cache: "no-store",
  });
  if (!response.ok) {
    params.set("select", "*,fotos:almacen_desguace_fotos(*)");
    response = await fetch(`${url}/rest/v1/almacen_desguace_piezas?${params}`, { headers: supabaseHeaders(key), cache: "no-store" });
  }
  const rows = await parseSupabaseResponse<PiezaDesguace[]>(response);
  return rows[0] || null;
}

export async function getPhotoCount(piezaId: string | number) {
  const { url, key } = getSupabaseApiConfig();
  const params = new URLSearchParams({ select: "id", pieza_id: `eq.${piezaId}` });
  const response = await fetch(`${url}/rest/v1/almacen_desguace_fotos?${params}`, {
    method: "HEAD",
    headers: supabaseHeaders(key, { Prefer: "count=exact" }),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Supabase error ${response.status}`);
  const range = response.headers.get("content-range");
  return Number(range?.split("/")[1] || 0);
}

export async function withPhotoUrls(photo: FotoDesguace) {
  if (/^https?:\/\//i.test(photo.url_imagen)) {
    return { ...photo, url_publica: photo.url_imagen, url_firmada: photo.url_imagen, url_visualizacion: photo.url_imagen };
  }

  const { url, key } = getSupabaseApiConfig();
  const encodedPath = photo.url_imagen.split("/").map(encodeURIComponent).join("/");
  const publicUrl = `${url}/storage/v1/object/public/almacen-desguace/${encodedPath}`;
  const response = await fetch(`${url}/storage/v1/object/sign/almacen-desguace/${encodedPath}`, {
    method: "POST",
    headers: supabaseHeaders(key),
    body: JSON.stringify({ expiresIn: 3600 }),
  });
  const data = response.ok ? await response.json() as { signedURL?: string; signedUrl?: string } : null;
  const signed = data?.signedURL || data?.signedUrl;
  return {
    ...photo,
    url_publica: publicUrl,
    url_firmada: signed ? (signed.startsWith("http") ? signed : `${url}/storage/v1${signed}`) : undefined,
    url_visualizacion: signed ? (signed.startsWith("http") ? signed : `${url}/storage/v1${signed}`) : publicUrl,
  };
}

export async function withPublicPhotos(pieza: PiezaDesguace) {
  return {
    ...pieza,
    fotos: await Promise.all([...(pieza.fotos || [])]
      .sort((a, b) => Number(b.es_principal) - Number(a.es_principal) || a.orden - b.orden)
      .map(withPhotoUrls)),
  };
}
