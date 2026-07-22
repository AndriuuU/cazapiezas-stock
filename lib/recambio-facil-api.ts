import "server-only";
import type { PiezaDesguace } from "@/types/almacen-desguace";

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

function recambioFacilCode(piece: PiezaDesguace, config: RecambioFacilConfig) {
  const clientPrefix = String(config.idcliente).slice(-3).padStart(3, "0");
  const pieceNumber = String(piece.id).padStart(6, "0").slice(-6);
  return `${clientPrefix}${pieceNumber}`;
}

function optional<T extends string | number>(value: T | null | undefined) {
  return value === null || value === undefined || value === "" ? undefined : value;
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
  const principal = text(piece.referencia_principal);
  const oem = text(piece.referencia_oem);
  const equivalents = text(piece.referencias_equivalentes).split(/[;,|\n]+/).map(text).filter(Boolean);
  if (principal && principal.length < 4) invalid.push("Referencia principal (mínimo 4 caracteres)");
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
  if (!text(piece.descripcion) && !text(piece.nombre_pieza)) missing.push("Descripción");
  if (piece.precio_venta === null || piece.precio_venta === undefined || !Number.isFinite(Number(piece.precio_venta))) missing.push("Precio");
  missing.push(...invalidReferenceFields(piece));
  return missing;
}

export function buildCatPayload(piece: PiezaDesguace, config: RecambioFacilConfig): CatPayload {
  const reference = referenceParts(piece);
  const images = (piece.fotos || []).map((photo) => photo.url_publica || photo.url_imagen).filter(Boolean).join(", ");
  return {
    Codigo: recambioFacilCode(piece, config),
    Idcliente: config.idcliente,
    Descripcion: text(piece.descripcion) || text(piece.nombre_pieza),
    Precio: Number(piece.precio_venta),
    Ubicacion: "almacenada",
    Referencia: optional(reference),
    Fechabase: date(piece.fecha_entrada),
    UbicacionEstanteria: shelfLocation(piece.ubicacion),
    Estado: "Material de segunda mano",
    PrecioPVP: Number(piece.precio_venta),
    Almacen: config.almacen,
    Observaciones: optional(text(piece.descripcion) || text(piece.nombre_pieza)),
    Marca: optional(text(piece.marca_vehiculo)),
    Modelo: optional(text(piece.modelo_vehiculo)),
    Imagenes: optional(images),
  };
}

export async function insertCatPiece(piece: PiezaDesguace, config: RecambioFacilConfig) {
  const endpoint = new URL(config.endpoint);
  endpoint.searchParams.set("idcliente", String(config.idcliente));
  const headers: Record<string, string> = { Accept: "application/json", "Content-Type": "application/json" };
  if (config.apiKey) headers["X-API-Key"] = config.apiKey;
  const response = await fetch(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify(buildCatPayload(piece, config)),
    cache: "no-store",
    signal: AbortSignal.timeout(30_000),
  });
  const raw = await response.text();
  let responseBody: unknown = raw;
  try { responseBody = raw ? JSON.parse(raw) : null; } catch { /* La API puede responder texto. */ }
  if (response.status !== 201) {
    const detail = typeof responseBody === "string"
      ? responseBody.slice(0, 400)
      : JSON.stringify(responseBody).slice(0, 400);
    throw new Error(`Recambio Fácil respondió ${response.status}${detail ? `: ${detail}` : ""}`);
  }
  return responseBody;
}

export async function insertCatPiecesBatch(pieces: PiezaDesguace[], config: RecambioFacilConfig) {
  if (!pieces.length || pieces.length > 10) throw new Error("Cada lote debe contener entre 1 y 10 piezas.");
  const endpoint = new URL(`${config.baseUrl}/CAT/batch`);
  const headers: Record<string, string> = { Accept: "application/json", "Content-Type": "application/json" };
  if (config.apiKey) headers["X-API-Key"] = config.apiKey;
  const response = await fetch(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify(pieces.map((piece) => buildCatPayload(piece, config))),
    cache: "no-store",
    signal: AbortSignal.timeout(45_000),
  });
  const raw = await response.text();
  let responseBody: unknown = raw;
  try { responseBody = raw ? JSON.parse(raw) : null; } catch { /* La API puede responder texto. */ }
  if (response.status !== 200 && response.status !== 207) {
    const detail = typeof responseBody === "string"
      ? responseBody.slice(0, 400)
      : JSON.stringify(responseBody).slice(0, 400);
    throw new Error(`Recambio Fácil batch respondió ${response.status}${detail ? `: ${detail}` : ""}`);
  }
  return { status: response.status, body: responseBody as CatBatchItemResponse[] | unknown };
}
