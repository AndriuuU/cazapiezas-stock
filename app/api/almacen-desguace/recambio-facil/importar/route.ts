import { NextResponse } from "next/server";
import {
  getCatPieceByCode,
  getRecambioFacilConfig,
  recambioFacilCentsToEuros,
  RecambioFacilRequestError,
  type CatRemotePiece,
} from "@/lib/recambio-facil-api";
import { protectApiRequest } from "@/lib/request-security";
import { getSupabaseApiConfig, parseSupabaseResponse, supabaseHeaders } from "@/lib/supabase-rest";
import type { EstadoPieza, PiezaDesguaceInput } from "@/types/almacen-desguace";

function remoteValue(remote: CatRemotePiece, ...aliases: string[]) {
  const entries = Object.entries(remote);
  for (const alias of aliases) {
    if (remote[alias] !== undefined) return remote[alias];
    const found = entries.find(([key]) => key.toLocaleLowerCase("es") === alias.toLocaleLowerCase("es"));
    if (found) return found[1];
  }
  return null;
}

function remoteText(remote: CatRemotePiece, ...aliases: string[]) {
  const value = remoteValue(remote, ...aliases);
  return value === null || value === undefined ? "" : String(value).trim();
}

function optionalText(value: string) {
  return value || null;
}

function optionalNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function optionalYear(value: unknown) {
  const number = optionalNumber(value);
  return number && Number.isInteger(number) && number >= 1900 && number <= 2100 ? number : null;
}

function dateOnly(value: unknown) {
  const text = value === null || value === undefined ? "" : String(value);
  const match = text.match(/^\d{4}-\d{2}-\d{2}/);
  return match?.[0] || new Date().toISOString().slice(0, 10);
}

function importedCondition(remote: CatRemotePiece): EstadoPieza {
  const condition = remoteText(remote, "Estado", "estado").toLocaleLowerCase("es");
  if (condition.includes("nueva") || condition.includes("nuevo")) return "Nueva";
  if (condition.includes("defecto")) return "Con defecto";
  return "Segunda mano sin comprobar";
}

function imageUrls(remote: CatRemotePiece) {
  const raw = remoteValue(remote, "Imagenes", "imagenes");
  if (Array.isArray(raw)) return raw.map(String).map((value) => value.trim()).filter(isHttpUrl);
  if (typeof raw !== "string" || !raw.trim()) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.map(String).map((value) => value.trim()).filter(isHttpUrl);
  } catch {
    // Algunas respuestas utilizan una lista de URLs separada por comas.
  }
  return raw.split(/\s*,\s*/).map((value) => value.trim()).filter(isHttpUrl);
}

function isHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function mapRemotePiece(remote: CatRemotePiece, externalCode: string): PiezaDesguaceInput {
  const reference2 = remoteText(remote, "Referencia2", "referencia2");
  const reference3 = remoteText(remote, "Referencia3", "referencia3");
  const stock = optionalNumber(remoteValue(remote, "Stock", "stock"));
  return {
    nombre_pieza: optionalText(remoteText(remote, "Descripcion", "descripcion")),
    descripcion: optionalText(remoteText(remote, "Observaciones", "observaciones")),
    categoria: optionalText(remoteText(remote, "Familia", "familia") || remoteText(remote, "Articulo", "tipoArticulo")),
    referencia_principal: optionalText(remoteText(remote, "Referencia", "referencia")),
    referencia_oem: optionalText(reference2),
    referencias_equivalentes: optionalText(reference3),
    marca_vehiculo: optionalText(remoteText(remote, "Marca", "marca")),
    modelo_vehiculo: optionalText(remoteText(remote, "Modelo", "modelo")),
    matricula_vehiculo: optionalText(remoteText(remote, "Matricula", "matricula")),
    codigo_motor: optionalText(remoteText(remote, "CodigoMotor", "codigomotor")),
    ano_desde: optionalYear(remoteValue(remote, "ModeloInicio", "modeloAnoInicio")),
    ano_hasta: optionalYear(remoteValue(remote, "ModeloFin", "modeloAnoFin")),
    estado_pieza: importedCondition(remote),
    cantidad: stock === null ? 1 : Math.max(0, Math.trunc(stock)),
    precio_venta: recambioFacilCentsToEuros(remoteValue(remote, "Precio", "preciocalculado", "PrecioPVP", "preciopvp")),
    ubicacion: null,
    cajon_id: null,
    procedencia: "Recambio Fácil · importada mediante API",
    estado_proceso: "Publicada",
    publicado_online: true,
    codigo_recambio_facil: externalCode,
    fecha_entrada: dateOnly(remoteValue(remote, "Fechabase", "fechabase")),
  };
}

export async function POST(request: Request) {
  const guard = await protectApiRequest(request, { keyPrefix: "desguace:rf-import", limit: 30, windowMs: 60_000 });
  if (guard) return guard;

  try {
    const body = await request.json() as { codigo?: unknown };
    const code = String(body.codigo ?? "").trim();
    if (!code) return NextResponse.json({ error: "Escribe el identificador de Recambio Fácil." }, { status: 400 });
    if (code.length > 100) return NextResponse.json({ error: "El identificador es demasiado largo." }, { status: 400 });
    if (!/^[a-zA-Z0-9_-]+$/.test(code)) {
      return NextResponse.json({ error: "El identificador solo puede contener letras, números, guiones y guiones bajos." }, { status: 400 });
    }

    const { url, key } = getSupabaseApiConfig();
    const duplicateParams = new URLSearchParams({
      select: "id,codigo_interno,nombre_pieza",
      codigo_recambio_facil: `ilike.${code}`,
      limit: "1",
    });
    const duplicateResponse = await fetch(`${url}/rest/v1/almacen_desguace_piezas?${duplicateParams}`, {
      headers: supabaseHeaders(key),
      cache: "no-store",
    });
    const duplicates = await parseSupabaseResponse<Array<{ id: number; codigo_interno: string; nombre_pieza: string | null }>>(duplicateResponse);
    if (duplicates[0]) {
      return NextResponse.json({
        error: `La pieza ya está importada como ${duplicates[0].codigo_interno}.`,
        existingId: duplicates[0].id,
      }, { status: 409 });
    }

    const config = getRecambioFacilConfig();
    if (!config.apiKey) return NextResponse.json({ error: "Falta configurar RECAMBIO_FACIL_API_KEY." }, { status: 500 });
    const result = await getCatPieceByCode(code, config);
    if (!result.piece) return NextResponse.json({ error: "Recambio Fácil no encontró ninguna pieza con ese identificador." }, { status: 404 });

    return NextResponse.json({
      code: result.externalCode,
      piece: mapRemotePiece(result.piece, result.externalCode),
      photoUrls: imageUrls(result.piece),
      message: "Pieza encontrada. Revisa los datos y pulsa Guardar pieza para importarla.",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo importar la pieza desde Recambio Fácil.";
    const status = error instanceof RecambioFacilRequestError
      ? error.status === 400 || error.status === 401 || error.status === 404 ? error.status : 502
      : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
