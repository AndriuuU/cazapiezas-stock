import { readFileSync } from "node:fs";

const env = Object.fromEntries(readFileSync(new URL("../.env.local", import.meta.url), "utf8")
  .split(/\r?\n/).filter((line) => line && !line.startsWith("#") && line.includes("="))
  .map((line) => { const index = line.indexOf("="); return [line.slice(0, index).trim(), line.slice(index + 1).trim().replace(/^['"]|['"]$/g, "")]; }));
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!url || !key) throw new Error("Falta la configuración de Supabase.");
const headers = { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };

async function request(path, options = {}) {
  const response = await fetch(`${url}/rest/v1/${path}`, { ...options, headers: { ...headers, ...options.headers } });
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(body?.message || body?.error || `Supabase ${response.status}`);
  return body;
}

const shelves = await request("herramientas_comunes_estanterias?select=id,codigo,configuracion&activa=eq.true");
const shelfIds = Object.fromEntries(shelves.map((shelf) => [shelf.codigo, shelf.id]));
for (const code of ["T01", "T02", "T03", "T04", "A01", "A02"]) {
  if (!shelfIds[code]) throw new Error(`No existe la estantería ${code}. Aplica primero la actualización 202608190002.`);
}
await request("herramientas_comunes_estanterias?codigo=in.(A01,A02)", { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ zona: "AUX" }) });

const examples = [
  { codigo: "DEMO-001", nombre: "Maletín de diagnosis", categoria: "Diagnosis", marca: "Bosch", shelf: "T01", nivel: 3, posicion: "C1", estado: "prestada", empleado_actual: "Santi", vehiculo_actual: null, retirada_at: new Date(Date.now() - 45 * 60_000).toISOString() },
  { codigo: "DEMO-002", nombre: "Juego de llaves combinadas", categoria: "Herramientas manuales", shelf: "T01", nivel: 2, posicion: "C1", estado: "disponible" },
  { codigo: "DEMO-003", nombre: "Pistola neumática", categoria: "Herramientas neumáticas", marca: "Bahco", shelf: "T01", nivel: 2, posicion: "C1", estado: "disponible" },
  { codigo: "DEMO-004", nombre: "Extractor de rodamientos", categoria: "Extractores", shelf: "T02", nivel: 4, posicion: "C1", estado: "disponible" },
  { codigo: "DEMO-005", nombre: "Kit para distribución", categoria: "Calado de motores", shelf: "T02", nivel: 3, posicion: "C1", estado: "prestada", empleado_actual: "Andrés", vehiculo_actual: "1234-ABC · Vehículo de prueba", retirada_at: new Date(Date.now() - 2 * 60 * 60_000).toISOString() },
  { codigo: "DEMO-006", nombre: "Compresímetro diésel", categoria: "Diagnosis", shelf: "T03", nivel: 5, posicion: "C1", estado: "disponible" },
  { codigo: "DEMO-007", nombre: "Cargador de baterías", categoria: "Electricidad", marca: "CTEK", shelf: "T03", nivel: 2, posicion: "C1", estado: "disponible" },
  { codigo: "DEMO-008", nombre: "Gato hidráulico", categoria: "Elevación", shelf: "T04", nivel: 1, posicion: "C1", estado: "disponible" },
  { codigo: "DEMO-009", nombre: "Llave dinamométrica", categoria: "Apriete", shelf: "A01", nivel: 3, posicion: "C1", estado: "disponible" },
  { codigo: "DEMO-010", nombre: "Multímetro", categoria: "Electricidad", marca: "Fluke", shelf: "A01", nivel: 3, posicion: "C2", estado: "perdida" },
  { codigo: "DEMO-011", nombre: "Cámara endoscópica", categoria: "Diagnosis", shelf: "A02", nivel: 8, posicion: "C1", estado: "disponible" },
  { codigo: "DEMO-012", nombre: "Máquina de humo", categoria: "Diagnosis", shelf: "A02", nivel: 1, posicion: "C1", estado: "disponible" },
];

const payload = examples.map(({ shelf, ...tool }) => ({
  codigo: tool.codigo,
  nombre: tool.nombre,
  categoria: tool.categoria || null,
  marca: tool.marca || null,
  estanteria_id: shelfIds[shelf],
  nivel: tool.nivel,
  posicion: tool.posicion,
  estado: tool.estado,
  descripcion: "Dato de demostración para probar Herramientas comunes.",
  foto_url: null,
  empleado_actual: tool.empleado_actual || null,
  vehiculo_actual: tool.vehiculo_actual || null,
  retirada_at: tool.retirada_at || null,
}));
const tools = await request("herramientas_comunes_herramientas?on_conflict=codigo&select=id,codigo,estado,empleado_actual,vehiculo_actual", {
  method: "POST",
  headers: { Prefer: "resolution=merge-duplicates,return=representation" },
  body: JSON.stringify(payload),
});

const ids = tools.map((tool) => tool.id);
const existing = ids.length ? await request(`herramientas_comunes_movimientos?select=herramienta_id&herramienta_id=in.(${ids.join(",")})`) : [];
const withHistory = new Set(existing.map((item) => item.herramienta_id));
const movements = tools.filter((tool) => !withHistory.has(tool.id)).flatMap((tool) => {
  const records = [{ herramienta_id: tool.id, tipo: "alta", empleado: null, vehiculo: null, estado_anterior: null, estado_nuevo: "disponible", detalle: "Herramienta de demostración registrada" }];
  if (tool.estado === "prestada") records.push({ herramienta_id: tool.id, tipo: "retirada", empleado: tool.empleado_actual, vehiculo: tool.vehiculo_actual, estado_anterior: "disponible", estado_nuevo: "prestada", detalle: "Préstamo de demostración" });
  if (tool.estado === "reparacion" || tool.estado === "perdida") records.push({ herramienta_id: tool.id, tipo: "cambio_estado", empleado: null, vehiculo: null, estado_anterior: "disponible", estado_nuevo: tool.estado, detalle: "Estado de demostración" });
  return records;
});
if (movements.length) await request("herramientas_comunes_movimientos", { method: "POST", body: JSON.stringify(movements) });

console.log(`Preparadas ${tools.length} herramientas de demostración.`);
