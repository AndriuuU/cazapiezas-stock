import "server-only";
import type { PiezaDesguace } from "@/types/almacen-desguace";
import { validateRecambioFacilRequiredFields } from "@/lib/recambio-facil-rules";

export type CatPayload = {
  Codigo: string;
  Idcliente: number;
  Descripcion: string;
  Precio: number;
  Ubicacion: string;
  Referencia?: string;
  Fechabase?: string;
  UbicacionEstanteria?: string;
  Estado?: string;
  PrecioPVP?: number;
  Almacen?: string;
  Observaciones?: string;
  Marca?: string;
  Modelo?: string;
  Imagenes?: string;
};

export type RecambioFacilConfig = {
  baseUrl: string;
  endpoint: string;
  idcliente: number;
  apiKey?: string;
  almacen: string;
};

export type CatBatchItemResponse = {
  Pieza: string;
  Estado: number;
  Mensaje: string;
};

export type CatRemotePiece = Partial<CatPayload> & Record<string, unknown>;

export class RecambioFacilRequestError extends Error {
  status: number;
  responseBody: unknown;

  constructor(action: string, status: number, responseBody: unknown) {
    const detail = responseDetail(responseBody);
    super(`Recambio Fácil respondió ${status} al ${action}${detail ? `: ${detail}` : ""}`);
    this.name = "RecambioFacilRequestError";
    this.status = status;
    this.responseBody = responseBody;
  }
}

function text(value: string | null | undefined) {
  return value?.trim() || "";
}

function date(value: string | null | undefined) {
  return value ? value.slice(0, 10) : undefined;
}

function shelfLocation(value: string | null | undefined) {
  const compact = text(value).replace(/^DESGUACE-/i, "").replace(/[^A-Z0-9]/gi, "").toUpperCase();
  return compact ? compact.slice(0, 10) : undefined;
}

export function getRecambioFacilCode(piece: PiezaDesguace, config: RecambioFacilConfig) {
  const savedCode = text(piece.codigo_recambio_facil);
  if (savedCode) return savedCode;
  const clientPrefix = String(config.idcliente).slice(-3).padStart(3, "0");
  const pieceNumber = String(piece.id).padStart(6, "0").slice(-6);
  return `${clientPrefix}${pieceNumber}`;
}

function optional<T extends string | number>(value: T | null | undefined) {
  return value === null || value === undefined || value === "" ? undefined : value;
}

export function eurosToRecambioFacilCents(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === "") {
    throw new Error("El precio de venta no es válido.");
  }
  const euros = Number(value);
  if (!Number.isFinite(euros) || euros < 0) throw new Error("El precio de venta no es válido.");
  return Math.round((euros + Number.EPSILON) * 100);
}

export function recambioFacilCentsToEuros(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const cents = Number(value);
  return Number.isFinite(cents) ? cents / 100 : null;
}

function referenceParts(piece: PiezaDesguace) {
  const internalCode = text(piece.codigo_interno).toLocaleLowerCase("es");
  const candidates = [
    piece.referencia_principal,
    piece.referencia_oem,
    ...text(piece.referencias_equivalentes).split(/[;,|\n]+/),
  ].map(text).filter((value) => value.length >= 4 && value.toLocaleLowerCase("es") !== internalCode);
  const references = [...new Set(candidates)];
  return references[0] || "";
}

function invalidReferenceFields(piece: PiezaDesguace) {
  const invalid: string[] = [];
  const oem = text(piece.referencia_oem);
  const equivalents = text(piece.referencias_equivalentes).split(/[;,|\n]+/).map(text).filter(Boolean);
  if (oem && oem.length < 4) invalid.push("Referencia OEM (mínimo 4 caracteres)");
  if (equivalents.some((reference) => reference.length < 4)) invalid.push("Referencias equivalentes (cada una debe tener al menos 4 caracteres)");
  return invalid;
}

export function getRecambioFacilConfig(): RecambioFacilConfig {
  const configuredUrl = process.env.RECAMBIO_FACIL_API_URL?.trim() || "https://apipre.recambio.recambiofacil.com";
  const idcliente = Number(process.env.RECAMBIO_FACIL_ID_CLIENTE || "31172");
  if (!configuredUrl) throw new Error("Falta configurar RECAMBIO_FACIL_API_URL.");
  if (!Number.isInteger(idcliente) || idcliente <= 0) throw new Error("Falta configurar un RECAMBIO_FACIL_ID_CLIENTE válido.");
  const baseUrl = configuredUrl.replace(/\/CAT\/?$/i, "").replace(/\/$/, "");
  const endpoint = `${baseUrl}/CAT`;
  const parsed = new URL(endpoint);
  if (!/^https?:$/.test(parsed.protocol)) throw new Error("RECAMBIO_FACIL_API_URL debe ser una dirección HTTP o HTTPS.");
  return {
    baseUrl,
    endpoint: parsed.toString(),
    idcliente,
    apiKey: process.env.RECAMBIO_FACIL_API_KEY?.trim() || process.env.RECAMBIO_FACIL_TOKEN?.trim() || undefined,
    almacen: process.env.RECAMBIO_FACIL_ALMACEN?.trim() || "Almacen",
  };
}

export function validateCatPiece(piece: PiezaDesguace, config: RecambioFacilConfig) {
  const missing: string[] = [];
  if (!text(piece.codigo_interno)) missing.push("Código");
  if (!config.idcliente) missing.push("IdCliente");
  missing.push(...validateRecambioFacilRequiredFields({ nombrePieza: piece.nombre_pieza, precio: piece.precio_venta, referenciaPrincipal: piece.referencia_principal, marca: piece.marca_vehiculo, modelo: piece.modelo_vehiculo }));
  missing.push(...invalidReferenceFields(piece));
  return missing;
}

export function buildCatPayload(piece: PiezaDesguace, config: RecambioFacilConfig): CatPayload {
  const reference = referenceParts(piece);
  const images = (piece.fotos || []).map((photo) => photo.url_publica || photo.url_imagen).filter(Boolean).join(", ");
  const priceInCents = eurosToRecambioFacilCents(piece.precio_venta);
  return {
    Codigo: getRecambioFacilCode(piece, config),
    Idcliente: config.idcliente,
    Descripcion: text(piece.nombre_pieza),
    Precio: priceInCents,
    Ubicacion: "almacenada",
    Referencia: optional(reference),
    Fechabase: date(piece.fecha_entrada),
    UbicacionEstanteria: shelfLocation(piece.ubicacion),
    Estado: "Material de segunda mano",
    PrecioPVP: priceInCents,
    Almacen: config.almacen,
    Observaciones: optional(text(piece.descripcion)),
    Marca: optional(text(piece.marca_vehiculo)),
    Modelo: optional(text(piece.modelo_vehiculo)),
    Imagenes: optional(images),
  };
}

function requestHeaders(config: RecambioFacilConfig, withBody = false) {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (withBody) headers["Content-Type"] = "application/json";
  if (config.apiKey) headers["x-api-key"] = config.apiKey;
  return headers;
}

async function readResponse(response: Response) {
  const raw = await response.text();
  let body: unknown = raw;
  try { body = raw ? JSON.parse(raw) : null; } catch { /* La API también puede responder texto. */ }
  return body;
}

function responseDetail(body: unknown) {
  if (typeof body === "string") return body.slice(0, 400);
  if (body === null || body === undefined) return "";
  try { return JSON.stringify(body).slice(0, 400); } catch { return "Respuesta no legible"; }
}

function findRemotePiece(value: unknown): CatRemotePiece | null {
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findRemotePiece(item);
      if (found) return found;
    }
    return null;
  }
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    const keys = new Set(Object.keys(record).map((key) => key.toLocaleLowerCase("es")));
    if (
      keys.has("codigo")
      || keys.has("referenciadms")
      || (keys.has("idcliente") && (keys.has("descripcion") || keys.has("referencia")))
    ) return record as CatRemotePiece;
  }
  return null;
}

export async function getCatPieceByCode(externalCode: string, config: RecambioFacilConfig) {
  const normalizedCode = text(externalCode);
  if (!normalizedCode) throw new Error("Indica el identificador de Recambio Fácil.");
  const endpoint = new URL(`${config.endpoint.replace(/\/$/, "")}/${encodeURIComponent(normalizedCode)}`);
  endpoint.searchParams.set("idcliente", String(config.idcliente));
  const response = await fetch(endpoint, {
    method: "GET",
    headers: requestHeaders(config),
    cache: "no-store",
    signal: AbortSignal.timeout(30_000),
  });
  const body = await readResponse(response);
  if (response.status === 404) return { externalCode: normalizedCode, piece: null, responseBody: body };
  if (response.status !== 200) throw new RecambioFacilRequestError("consultar el recambio", response.status, body);
  const remotePiece = findRemotePiece(body);
  if (!remotePiece) throw new Error("Recambio Fácil confirmó la consulta, pero no devolvió los datos de la pieza.");
  return { externalCode: normalizedCode, piece: remotePiece, responseBody: body };
}

export async function getCatPiece(piece: PiezaDesguace, config: RecambioFacilConfig) {
  return getCatPieceByCode(getRecambioFacilCode(piece, config), config);
}

export async function updateCatPiece(piece: PiezaDesguace, config: RecambioFacilConfig) {
  const endpoint = new URL(config.endpoint);
  endpoint.searchParams.set("idcliente", String(config.idcliente));
  const payload = buildCatPayload(piece, config);
  const response = await fetch(endpoint, {
    method: "PUT",
    headers: requestHeaders(config, true),
    body: JSON.stringify(payload),
    cache: "no-store",
    signal: AbortSignal.timeout(30_000),
  });
  const body = await readResponse(response);
  if (response.status !== 200 && response.status !== 201) {
    throw new RecambioFacilRequestError("actualizar el recambio", response.status, body);
  }
  return { externalCode: payload.Codigo, payload, responseBody: body };
}

export async function deleteCatPiece(piece: PiezaDesguace, config: RecambioFacilConfig) {
  const externalCode = getRecambioFacilCode(piece, config);
  const endpoint = new URL(`${config.endpoint.replace(/\/$/, "")}/${encodeURIComponent(externalCode)}`);
  endpoint.searchParams.set("idcliente", String(config.idcliente));
  const response = await fetch(endpoint, {
    method: "DELETE",
    headers: requestHeaders(config),
    cache: "no-store",
    signal: AbortSignal.timeout(30_000),
  });
  const body = await readResponse(response);
  if (response.status !== 200) throw new RecambioFacilRequestError("eliminar el recambio", response.status, body);
  return { externalCode, responseBody: body };
}

export async function insertCatPiece(piece: PiezaDesguace, config: RecambioFacilConfig) {
  const endpoint = new URL(config.endpoint);
  endpoint.searchParams.set("idcliente", String(config.idcliente));
  const response = await fetch(endpoint, {
    method: "POST",
    headers: requestHeaders(config, true),
    body: JSON.stringify(buildCatPayload(piece, config)),
    cache: "no-store",
    signal: AbortSignal.timeout(30_000),
  });
  const responseBody = await readResponse(response);
  if (response.status !== 201) {
    throw new RecambioFacilRequestError("insertar el recambio", response.status, responseBody);
  }
  return responseBody;
}

export async function insertCatPiecesBatch(pieces: PiezaDesguace[], config: RecambioFacilConfig) {
  if (!pieces.length || pieces.length > 10) throw new Error("Cada lote debe contener entre 1 y 10 piezas.");
  const endpoint = new URL(`${config.baseUrl}/CAT/batch`);
  const response = await fetch(endpoint, {
    method: "POST",
    headers: requestHeaders(config, true),
    body: JSON.stringify(pieces.map((piece) => buildCatPayload(piece, config))),
    cache: "no-store",
    signal: AbortSignal.timeout(45_000),
  });
  const responseBody = await readResponse(response);
  if (response.status !== 200 && response.status !== 207) {
    throw new RecambioFacilRequestError("publicar el lote", response.status, responseBody);
  }
  return { status: response.status, body: responseBody as CatBatchItemResponse[] | unknown };
}
