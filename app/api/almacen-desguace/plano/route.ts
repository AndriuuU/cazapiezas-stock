import { NextResponse } from "next/server";
import { protectAdminApiRequest } from "@/lib/request-security";
import { getSupabaseApiConfig, supabaseHeaders } from "@/lib/supabase-rest";

type PlanoInput = {
  tipo: "estanteria" | "zona_suelo";
  codigo_estanteria: string | null;
  nombre: string;
  x: number;
  y: number;
  ancho: number;
  alto: number;
  rotacion: 0 | 90;
  color: string;
  orden: number;
};

function finiteNumber(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.round(number * 100) / 100 : NaN;
}

function normalizeElement(value: unknown, index: number): PlanoInput {
  const source = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
  const tipo = source.tipo === "zona_suelo" ? "zona_suelo" : "estanteria";
  return {
    tipo,
    codigo_estanteria: tipo === "estanteria" ? String(source.codigo_estanteria || "").trim().toUpperCase() : null,
    nombre: String(source.nombre || "").trim().slice(0, 80),
    x: finiteNumber(source.x),
    y: finiteNumber(source.y),
    ancho: finiteNumber(source.ancho),
    alto: finiteNumber(source.alto),
    rotacion: Number(source.rotacion) === 90 ? 90 : 0,
    color: /^#[0-9a-f]{6}$/i.test(String(source.color || "")) ? String(source.color).toLowerCase() : "#64748b",
    orden: index,
  };
}

function validateElements(elements: PlanoInput[]) {
  if (elements.length > 100) return "El plano no puede tener más de 100 elementos.";
  const shelfCodes = new Set<string>();
  for (const element of elements) {
    if (element.tipo === "estanteria") {
      if (!element.codigo_estanteria || !/^E\d{2}$/.test(element.codigo_estanteria)) return "Hay una estantería con un código no válido.";
      if (shelfCodes.has(element.codigo_estanteria)) return `La estantería ${element.codigo_estanteria} aparece dos veces.`;
      shelfCodes.add(element.codigo_estanteria);
    }
    if (element.tipo === "zona_suelo" && !element.nombre) return "Todas las zonas de suelo deben tener un nombre.";
    if (![element.x, element.y, element.ancho, element.alto].every(Number.isFinite)) return "Hay un elemento con medidas no válidas.";
    if (element.x < 0 || element.x > 1200 || element.y < 0 || element.y > 1500) return "Hay un elemento fuera de los límites del plano.";
    if (element.ancho < 40 || element.ancho > 600 || element.alto < 30 || element.alto > 500) return "Hay un elemento con un tamaño no válido.";
  }
  return null;
}

export async function PUT(request: Request) {
  const guard = await protectAdminApiRequest(request, { keyPrefix: "desguace:warehouse-layout", limit: 30, windowMs: 60_000 });
  if (guard) return guard;

  try {
    const body = await request.json();
    if (!Array.isArray(body?.elementos)) return NextResponse.json({ error: "La distribución del plano no es válida." }, { status: 400 });
    const elements = body.elementos.map(normalizeElement);
    const validationError = validateElements(elements);
    if (validationError) return NextResponse.json({ error: validationError }, { status: 400 });

    const { url, key } = getSupabaseApiConfig();
    const response = await fetch(`${url}/rest/v1/rpc/almacen_desguace_guardar_plano`, {
      method: "POST",
      headers: supabaseHeaders(key),
      body: JSON.stringify({ elementos: elements }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => null);
      const missingMigration = response.status === 404 || error?.code === "PGRST202" || error?.code === "42883";
      return NextResponse.json({
        error: missingMigration
          ? "Falta aplicar la migración 202607210001_plano_almacen_editable.sql."
          : error?.message || "No se pudo guardar la distribución del plano.",
      }, { status: missingMigration ? 409 : 500 });
    }

    return NextResponse.json({ ok: true, elementos: elements.length });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo guardar la distribución del plano." }, { status: 500 });
  }
}
