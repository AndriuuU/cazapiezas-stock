import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const PIECES_TABLE = "almacen_desguace_piezas";
const PHOTOS_TABLE = "almacen_desguace_fotos";
const SOURCE_PREFIX = "CAT stockcat.csv";
const commit = process.argv.includes("--commit");
const csvPath = process.argv.find((value) => value.toLowerCase().endsWith(".csv"));

if (!csvPath) throw new Error("Indica la ruta del CSV.");

function parseEnv(text) {
  return Object.fromEntries(text.split(/\r?\n/).map((line) => line.trim()).filter((line) => line && !line.startsWith("#") && line.includes("=")).map((line) => {
    const index = line.indexOf("=");
    return [line.slice(0, index), line.slice(index + 1).replace(/^['\"]|['\"]$/g, "")];
  }));
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < text.length; index++) {
    const char = text[index];
    if (quoted) {
      if (char === '"' && text[index + 1] === '"') { field += '"'; index++; }
      else if (char === '"') quoted = false;
      else field += char;
    } else if (char === '"') quoted = true;
    else if (char === ",") { row.push(field); field = ""; }
    else if (char === "\n") { row.push(field.replace(/\r$/, "")); rows.push(row); row = []; field = ""; }
    else field += char;
  }
  if (field || row.length) { row.push(field.replace(/\r$/, "")); rows.push(row); }
  return rows;
}

function clean(value) {
  const text = String(value || "").trim();
  return text || null;
}

function number(value) {
  const parsed = Number(String(value || "").trim().replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

function photoUrls(value) {
  return String(value || "").replaceAll("\\/", "/").replace(/^\[/, "").replace(/\]$/, "").split(",").map((url) => url.trim()).filter((url) => /^https?:\/\//i.test(url));
}

function chunks(items, size) {
  return Array.from({ length: Math.ceil(items.length / size) }, (_, index) => items.slice(index * size, (index + 1) * size));
}

const env = parseEnv(await readFile(resolve(".env.local"), "utf8"));
const supabaseUrl = env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL;
const apiKey = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_ANON_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!supabaseUrl || !apiKey) throw new Error("Faltan las variables de Supabase en .env.local.");

const headers = { apikey: apiKey, Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" };
async function request(path, options = {}) {
  const response = await fetch(`${supabaseUrl}${path}`, { ...options, headers: { ...headers, ...(options.headers || {}) } });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Supabase ${response.status}: ${body}`);
  }
  if (response.status === 204 || options.method === "HEAD") return null;
  const body = await response.text();
  return body ? JSON.parse(body) : null;
}

async function countPhotosForPieces(pieceIds) {
  let count = 0;
  for (const idBatch of chunks(pieceIds, 100)) {
    const params = new URLSearchParams({ select: "id", pieza_id: `in.(${idBatch.join(",")})`, limit: "1000" });
    count += (await request(`/rest/v1/${PHOTOS_TABLE}?${params}`)).length;
  }
  return count;
}

const bytes = await readFile(csvPath);
const rows = parseCsv(new TextDecoder("windows-1252").decode(bytes));
if (rows.length < 2 || rows[0].length !== 46) throw new Error("El CSV no tiene la estructura CAT esperada de 46 columnas.");
const sourceRows = rows.slice(1).filter((row) => row.some((value) => value.trim()));
if (sourceRows.some((row) => row.length !== 46)) throw new Error("Hay filas CAT con un número de columnas inesperado.");

const transformed = sourceRows.map((row, index) => {
  const alternativeReferences = [clean(row[2]), clean(row[3])].filter(Boolean);
  const internalReference = clean(row[0]);
  const sourceKey = `${SOURCE_PREFIX} | fila ${index + 2} | ref-interna ${internalReference || "-"}`;
  return {
    sourceKey,
    piece: {
      nombre_pieza: clean(row[4]),
      descripcion: `Pieza usada importada desde CAT${internalReference ? `. Referencia interna CAT: ${internalReference}` : ""}.`,
      categoria: null,
      marca_pieza: null,
      referencia_principal: clean(row[1]),
      referencia_oem: clean(row[2]),
      referencias_equivalentes: alternativeReferences.length ? alternativeReferences.join(", ") : null,
      marca_vehiculo: clean(row[13]),
      modelo_vehiculo: clean(row[14]),
      motorizacion: clean(row[40]),
      codigo_motor: null,
      ano_desde: null,
      ano_hasta: null,
      estado_pieza: "Segunda mano sin comprobar",
      cantidad: Math.max(0, Math.trunc(number(row[5]) ?? 1)),
      precio_coste: Math.max(0, number(row[6]) ?? 0),
      precio_venta: Math.max(0, number(row[22]) ?? number(row[8]) ?? 0),
      ubicacion: null,
      procedencia: sourceKey,
      estado_proceso: "Pendiente de comprobar",
      publicado_online: true,
      fecha_entrada: clean(row[17]),
    },
    photos: photoUrls(row[45]),
  };
});

const summary = {
  mode: commit ? "IMPORTACIÓN" : "SIMULACIÓN",
  pieces: transformed.length,
  photos: transformed.reduce((total, item) => total + item.photos.length, 0),
  piecesWithoutName: transformed.filter((item) => !item.piece.nombre_pieza).length,
  piecesWithoutReference: transformed.filter((item) => !item.piece.referencia_principal).length,
  piecesWithoutPhotos: transformed.filter((item) => item.photos.length === 0).length,
};
console.log(JSON.stringify(summary, null, 2));
if (!commit) process.exit(0);

const existingParams = new URLSearchParams({ select: "id,procedencia,publicado_online", procedencia: `like.${SOURCE_PREFIX}*`, limit: "1000" });
const existing = await request(`/rest/v1/${PIECES_TABLE}?${existingParams}`);
const existingSources = new Set(existing.map((piece) => piece.procedencia));
const pending = transformed.filter((item) => !existingSources.has(item.sourceKey));
const offlineExisting = existing.filter((piece) => !piece.publicado_online);
for (const batch of chunks(offlineExisting.map((piece) => piece.id), 100)) {
  const params = new URLSearchParams({ id: `in.(${batch.join(",")})` });
  await request(`/rest/v1/${PIECES_TABLE}?${params}`, {
    method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ publicado_online: true }),
  });
}
if (!pending.length) {
  const existingPhotoCount = await countPhotosForPieces(existing.map((piece) => piece.id));
  const verified = existing.length === transformed.length && existingPhotoCount === summary.photos;
  console.log(JSON.stringify({ importedPieces: 0, importedPhotos: 0, markedOnline: offlineExisting.length, skippedExisting: transformed.length, totalCatPieces: existing.length, totalCatPhotos: existingPhotoCount, verified }, null, 2));
  if (!verified) throw new Error("La importación CAT existente está incompleta; debe repararse antes de continuar.");
  process.exit(0);
}

const insertedPieces = [];
try {
  for (const batch of chunks(pending, 50)) {
    const rowsInserted = await request(`/rest/v1/${PIECES_TABLE}?select=id,procedencia`, {
      method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify(batch.map((item) => item.piece)),
    });
    insertedPieces.push(...rowsInserted);
  }
  const idBySource = new Map(insertedPieces.map((piece) => [piece.procedencia, piece.id]));
  const photos = pending.flatMap((item) => item.photos.map((url, order) => ({ pieza_id: idBySource.get(item.sourceKey), url_imagen: url, es_principal: order === 0, orden: order })));
  for (const batch of chunks(photos, 100)) {
    await request(`/rest/v1/${PHOTOS_TABLE}`, { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify(batch) });
  }
  const verifyParams = new URLSearchParams({ select: "id,procedencia", procedencia: `like.${SOURCE_PREFIX}*`, limit: "1000" });
  const verifiedPieces = await request(`/rest/v1/${PIECES_TABLE}?${verifyParams}`);
  const allIds = verifiedPieces.map((piece) => piece.id);
  const verifiedPhotos = await countPhotosForPieces(allIds);
  console.log(JSON.stringify({ importedPieces: insertedPieces.length, importedPhotos: photos.length, skippedExisting: existing.length, totalCatPieces: verifiedPieces.length, totalCatPhotos: verifiedPhotos, verified: verifiedPieces.length === transformed.length && verifiedPhotos === summary.photos }, null, 2));
} catch (error) {
  if (insertedPieces.length) {
    for (const batch of chunks(insertedPieces.map((piece) => piece.id), 100)) {
      const params = new URLSearchParams({ id: `in.(${batch.join(",")})` });
      await request(`/rest/v1/${PIECES_TABLE}?${params}`, { method: "DELETE", headers: { Prefer: "return=minimal" } }).catch(() => null);
    }
  }
  throw error;
}
