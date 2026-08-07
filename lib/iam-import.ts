import { createHash } from "node:crypto";
import type { DetallePiezaIam, PiezaDesguaceInput } from "@/types/almacen-desguace";
import { recambioFacilCentsToEuros, type IamRemotePiece } from "@/lib/recambio-facil-api";

export type IamImportRecord = {
  base: PiezaDesguaceInput;
  iam: Omit<DetallePiezaIam, "pieza_id" | "created_at" | "updated_at">;
};

function cleanText(value: unknown) {
  const text = value === null || value === undefined ? "" : String(value).trim();
  const formula = text.match(/^="([\s\S]*)"$/);
  return (formula?.[1] ?? text).trim();
}

function optionalText(value: unknown) {
  return cleanText(value) || null;
}

function optionalNumber(value: unknown) {
  const raw = cleanText(value).replace(/\s|€|%/g, "");
  if (!raw) return null;
  const normalized = raw.includes(",") ? raw.replace(/\./g, "").replace(",", ".") : raw;
  const number = Number(normalized);
  return Number.isFinite(number) ? number : null;
}

function optionalInteger(value: unknown) {
  const number = optionalNumber(value);
  return number === null ? null : Math.trunc(number);
}

function dateOnly(value: unknown) {
  const raw = cleanText(value);
  if (!raw) return null;
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const spanish = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
  if (spanish) return `${spanish[3]}-${spanish[2].padStart(2, "0")}-${spanish[1].padStart(2, "0")}`;
  return null;
}

function normalizedKey(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es").replace(/[^a-z0-9]/g, "");
}

function value(record: Record<string, unknown>, ...names: string[]) {
  const entries = Object.entries(record);
  for (const name of names) {
    const exact = record[name];
    if (exact !== undefined) return exact;
    const wanted = normalizedKey(name);
    const found = entries.find(([key]) => normalizedKey(key) === wanted);
    if (found) return found[1];
  }
  return null;
}

function importKey(parts: unknown[]) {
  const source = parts.map(cleanText).map((item) => item.toLocaleUpperCase("es")).join("|");
  return createHash("sha256").update(source).digest("hex");
}

function emptyOrigin(record: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(record).filter(([, item]) => cleanText(item) !== ""));
}

export function parseIamCsv(buffer: ArrayBuffer) {
  const source = new TextDecoder("windows-1252").decode(buffer).replace(/^\uFEFF/, "");
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < source.length; index++) {
    const char = source[index];
    if (char === '"') {
      if (quoted && source[index + 1] === '"') { cell += '"'; index++; }
      else quoted = !quoted;
    } else if (char === ";" && !quoted) {
      row.push(cell); cell = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && source[index + 1] === "\n") index++;
      row.push(cell); cell = "";
      if (row.some((item) => item.trim())) rows.push(row);
      row = [];
    } else cell += char;
  }
  if (cell || row.length) { row.push(cell); if (row.some((item) => item.trim())) rows.push(row); }
  const headers = rows.shift()?.map(cleanText) || [];
  if (!headers.length) throw new Error("El CSV está vacío.");
  return rows.map((cells) => Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? ""])));
}

export function mapIamCsvRecord(record: Record<string, unknown>): IamImportRecord {
  const reference = value(record, "Referencia");
  const reference2 = value(record, "Referencia2", "Referencia 2");
  const reference3 = value(record, "Referencia3", "Referencia 3");
  const description = value(record, "Descripcion", "Descripción");
  const publishedPrice = optionalNumber(value(record, "Precio Publicado", "Precio"));
  const basePrice = optionalNumber(value(record, "Precio Base"));
  const insertionDate = dateOnly(value(record, "Fecha inserción", "Fecha insercion"));
  const key = importKey([reference, reference2, reference3, description]);
  return {
    base: {
      tipo_pieza: "IAM",
      nombre_pieza: optionalText(description),
      categoria: optionalText(value(record, "Familia")),
      marca_pieza: optionalText(value(record, "Marca-RF", "Marca RF", "Marca")),
      referencia_principal: optionalText(reference),
      referencia_oem: optionalText(reference2),
      referencias_equivalentes: optionalText(reference3),
      estado_pieza: "Nueva",
      cantidad: Math.max(0, optionalInteger(value(record, "Stock", "Cantidad")) ?? 0),
      precio_venta: publishedPrice ?? basePrice,
      procedencia: "Importación IAM · CSV",
      estado_proceso: "Pendiente de identificar",
      publicado_online: false,
      fecha_entrada: insertionDate || new Date().toISOString().slice(0, 10),
    },
    iam: {
      codigo_iam: optionalInteger(value(record, "Codigo", "Código")),
      idcliente: optionalInteger(value(record, "Idcliente", "Id cliente")),
      referencia_2: optionalText(reference2), referencia_3: optionalText(reference3),
      marca_rf: optionalText(value(record, "Marca-RF", "Marca RF", "Marca")),
      id_marca: optionalInteger(value(record, "IdMarca", "Id Marca")),
      familia: optionalText(value(record, "Familia")),
      precio_base: basePrice,
      precio_ecotasa: optionalNumber(value(record, "Precio Ecotasa", "Ecotasa")),
      precio_publicado: publishedPrice,
      importe_casco: optionalNumber(value(record, "Importe Casco")),
      precio_pvp: optionalNumber(value(record, "Precio PVP")),
      precio_pue: optionalNumber(value(record, "Precio PUE")),
      precio_pm: optionalNumber(value(record, "Precio PM")),
      fecha_base: dateOnly(value(record, "Fecha base")),
      fecha_insercion: insertionDate,
      fecha_ultima_entrada: dateOnly(value(record, "Fecha última entrada", "Fecha ultima entrada")),
      fecha_ultima_salida: dateOnly(value(record, "Fecha última salida", "Fecha ultima salida")),
      fecha_ultimo_movimiento: dateOnly(value(record, "Fecha último movimiento", "Fecha ultimo movimiento")),
      forma_publicacion: optionalText(value(record, "Forma publicación", "Forma publicacion")),
      almacen_origen: optionalText(value(record, "Almacén", "Almacen")),
      ubicacion_estanteria_origen: optionalText(value(record, "Ubicación estantería", "Ubicacion estanteria")),
      peso: optionalNumber(value(record, "Peso")), largo: optionalNumber(value(record, "Largo")),
      ancho: optionalNumber(value(record, "Ancho")), alto: optionalNumber(value(record, "Alto")),
      clave_importacion: key,
      datos_origen: emptyOrigin(record),
    },
  };
}

export function mapIamApiRecord(remote: IamRemotePiece): IamImportRecord {
  const code = optionalInteger(value(remote, "Codigo"));
  const client = optionalInteger(value(remote, "Idcliente"));
  const reference = value(remote, "Referencia");
  const reference2 = value(remote, "Referencia2");
  const reference3 = value(remote, "Referencia3");
  const description = value(remote, "Descripcion");
  const price = recambioFacilCentsToEuros(value(remote, "Precio"));
  const fechaBase = dateOnly(value(remote, "Fechabase"));
  return {
    base: {
      tipo_pieza: "IAM", nombre_pieza: optionalText(description),
      categoria: optionalText(value(remote, "Familia")), marca_pieza: optionalText(value(remote, "Marca")),
      referencia_principal: optionalText(reference), referencia_oem: optionalText(reference2),
      referencias_equivalentes: optionalText(reference3), estado_pieza: "Nueva",
      cantidad: Math.max(0, optionalInteger(value(remote, "Cantidad")) ?? 0), precio_venta: price,
      procedencia: "Recambio Fácil · IAM", estado_proceso: "Pendiente de identificar",
      publicado_online: false, fecha_entrada: fechaBase || new Date().toISOString().slice(0, 10),
    },
    iam: {
      codigo_iam: code, idcliente: client, referencia_2: optionalText(reference2), referencia_3: optionalText(reference3),
      marca_rf: optionalText(value(remote, "Marca")), id_marca: optionalInteger(value(remote, "IdMarca")),
      familia: optionalText(value(remote, "Familia")), precio_base: price, precio_ecotasa: null,
      precio_publicado: price, importe_casco: recambioFacilCentsToEuros(value(remote, "ImporteCasco")),
      precio_pvp: recambioFacilCentsToEuros(value(remote, "Preciopvp")),
      precio_pue: recambioFacilCentsToEuros(value(remote, "Preciopue")),
      precio_pm: recambioFacilCentsToEuros(value(remote, "Preciopm")), fecha_base: fechaBase,
      fecha_insercion: null, fecha_ultima_entrada: dateOnly(value(remote, "Fechaultimaentrada")),
      fecha_ultima_salida: dateOnly(value(remote, "Fechaultimasalida")),
      fecha_ultimo_movimiento: dateOnly(value(remote, "Fechaultimomovimiento")), forma_publicacion: "API",
      almacen_origen: optionalText(value(remote, "Almacen")),
      ubicacion_estanteria_origen: optionalText(value(remote, "Ubicacionestanteria")),
      peso: optionalNumber(value(remote, "Peso")), largo: optionalNumber(value(remote, "Largo")),
      ancho: optionalNumber(value(remote, "Ancho")), alto: optionalNumber(value(remote, "Alto")),
      clave_importacion: importKey(["API", client, code]), datos_origen: remote,
    },
  };
}
