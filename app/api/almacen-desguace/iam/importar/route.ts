import { NextResponse } from "next/server";
import { getIamPieceByCode, getRecambioFacilConfig, RecambioFacilRequestError } from "@/lib/recambio-facil-api";
import { mapIamApiRecord, mapIamCsvRecord, parseIamCsv, type IamImportRecord } from "@/lib/iam-import";
import { protectAdminApiRequest } from "@/lib/request-security";
import { getSupabaseApiConfig, parseSupabaseResponse, supabaseHeaders } from "@/lib/supabase-rest";

const MAX_FILE_BYTES = 8 * 1024 * 1024;
type SaveResult = { insertadas: number; actualizadas: number; ids: number[] };

async function save(records: IamImportRecord[]) {
  const { url, key } = getSupabaseApiConfig();
  const response = await fetch(`${url}/rest/v1/rpc/importar_piezas_iam`, {
    method: "POST",
    headers: supabaseHeaders(key),
    body: JSON.stringify({ p_registros: records }),
    cache: "no-store",
  });
  return parseSupabaseResponse<SaveResult>(response);
}

async function markAsAlreadyPublished(ids: number[]) {
  if (!ids.length) return;
  const { url, key } = getSupabaseApiConfig();
  const response = await fetch(`${url}/rest/v1/almacen_desguace_piezas?id=in.(${ids.join(",")})`, {
    method: "PATCH",
    headers: supabaseHeaders(key, { Prefer: "return=minimal" }),
    body: JSON.stringify({ publicado_online: true, estado_proceso: "Publicada" }),
    cache: "no-store",
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.message || body?.error || "La pieza se guardó, pero no se pudo marcar como publicada.");
  }
}

function preview(records: IamImportRecord[]) {
  const invalid = records.filter((record) => !record.base.referencia_principal && !record.base.nombre_pieza).length;
  const stock = records.reduce((total, record) => total + Number(record.base.cantidad || 0), 0);
  return {
    total: records.length,
    validas: records.length - invalid,
    invalidas: invalid,
    stock,
    muestra: records.slice(0, 8).map((record) => ({
      referencia: record.base.referencia_principal,
      descripcion: record.base.nombre_pieza,
      marca: record.base.marca_pieza,
      cantidad: record.base.cantidad,
      precio: record.base.precio_venta,
    })),
  };
}

export async function POST(request: Request) {
  const guard = await protectAdminApiRequest(request, { keyPrefix: "desguace:iam-import", limit: 20, windowMs: 60_000 });
  if (guard) return guard;
  try {
    const contentType = request.headers.get("content-type") || "";
    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      const file = form.get("file");
      const action = form.get("action") === "import" ? "import" : "preview";
      if (!(file instanceof File)) return NextResponse.json({ error: "Selecciona el CSV de piezas IAM." }, { status: 400 });
      if (file.size > MAX_FILE_BYTES) return NextResponse.json({ error: "El CSV supera el límite de 8 MB." }, { status: 413 });
      const rows = parseIamCsv(await file.arrayBuffer());
      const records = rows.map(mapIamCsvRecord).filter((record) => record.base.referencia_principal || record.base.nombre_pieza);
      if (!records.length) return NextResponse.json({ error: "El CSV no contiene piezas IAM reconocibles." }, { status: 400 });
      if (action === "preview") return NextResponse.json({ preview: preview(records) });
      return NextResponse.json({ result: await save(records), preview: preview(records) });
    }

    const body = await request.json() as {
      mode?: unknown; codigo?: unknown; action?: unknown;
      referencia?: unknown; referencia2?: unknown; referencia3?: unknown;
      descripcion?: unknown; marca?: unknown; stock?: unknown;
      precio?: unknown; importe_casco?: unknown; publicado_online?: unknown;
    };

    if (body.mode === "manual") {
      const referencia = String(body.referencia ?? "").trim();
      const descripcion = String(body.descripcion ?? "").trim();
      const marca = String(body.marca ?? "").trim();
      const stock = Number(body.stock);
      const precio = Number(body.precio);
      const importeCasco = Number(body.importe_casco || 0);
      if (!referencia) return NextResponse.json({ error: "Escribe la referencia IAM equivalente." }, { status: 400 });
      if (!descripcion) return NextResponse.json({ error: "Escribe la descripción de la pieza." }, { status: 400 });
      if (!marca) return NextResponse.json({ error: "Escribe la marca IAM equivalente." }, { status: 400 });
      if (!Number.isInteger(stock) || stock < 0) return NextResponse.json({ error: "El stock debe ser un número entero válido." }, { status: 400 });
      if (!Number.isFinite(precio) || precio < 0) return NextResponse.json({ error: "El importe de venta no es válido." }, { status: 400 });
      if (!Number.isFinite(importeCasco) || importeCasco < 0) return NextResponse.json({ error: "El importe de casco no es válido." }, { status: 400 });

      const published = body.publicado_online === true;
      const record = mapIamCsvRecord({
        Referencia: referencia,
        Referencia2: String(body.referencia2 ?? "").trim(),
        Referencia3: String(body.referencia3 ?? "").trim(),
        Descripcion: descripcion,
        Marca: marca,
        Stock: stock,
        "Precio Publicado": precio,
        "Importe Casco": importeCasco,
        "Forma publicación": published ? "Manual" : "Pendiente",
      });
      record.base.procedencia = published ? "Recambio Fácil · IAM manual" : "Alta IAM manual";
      record.base.publicado_online = published;
      record.base.estado_proceso = published ? "Publicada" : "Lista para publicar";
      record.iam.forma_publicacion = published ? "Manual" : "Pendiente";
      const result = await save([record]);
      if (published) await markAsAlreadyPublished(result.ids);
      return NextResponse.json({ piece: record, result });
    }

    const code = Number(body.codigo);
    if (!Number.isInteger(code) || code <= 0) return NextResponse.json({ error: "Escribe un código IAM válido." }, { status: 400 });
    const config = getRecambioFacilConfig();
    if (!config.apiKey) return NextResponse.json({ error: "Falta configurar RECAMBIO_FACIL_API_KEY." }, { status: 500 });
    const remote = await getIamPieceByCode(code, config);
    if (!remote.piece) return NextResponse.json({ error: "Recambio Fácil no encontró ese recambio IAM." }, { status: 404 });
    const record = mapIamApiRecord(remote.piece);
    if (body.action === "import") return NextResponse.json({ piece: record, result: await save([record]) });
    return NextResponse.json({ piece: record, preview: preview([record]) });
  } catch (error) {
    const status = error instanceof RecambioFacilRequestError
      ? error.status === 401 || error.status === 404 ? error.status : 502
      : 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudieron importar las piezas IAM." }, { status });
  }
}
