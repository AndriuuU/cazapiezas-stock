import {
  ESTADOS_PIEZA,
  ESTADOS_PROCESO,
  type EstadoProceso,
  type PiezaDesguaceInput,
} from "@/types/almacen-desguace";

export const UBICACION_PATTERN = /^DESGUACE-E\d{2}-N\d{2}-C\d{2}$/;

const TEXT_FIELDS = [
  "nombre_pieza", "descripcion", "categoria", "marca_pieza",
  "referencia_principal", "referencia_oem", "referencias_equivalentes",
  "marca_vehiculo", "modelo_vehiculo", "motorizacion", "codigo_motor",
  "ubicacion", "procedencia", "fecha_entrada",
] as const;
const NUMBER_FIELDS = [
  "ano_desde", "ano_hasta", "cantidad", "precio_coste", "precio_venta",
] as const;

export function normalizePiezaInput(value: unknown): PiezaDesguaceInput {
  const source = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
  const result: Record<string, unknown> = {};

  for (const field of TEXT_FIELDS) {
    if (field in source) {
      const text = String(source[field] ?? "").trim();
      result[field] = text || null;
    }
  }
  for (const field of NUMBER_FIELDS) {
    if (field in source) {
      const raw = source[field];
      result[field] = raw === "" || raw === null || raw === undefined ? null : Number(raw);
    }
  }
  if ("estado_pieza" in source) result.estado_pieza = source.estado_pieza || null;
  if ("estado_proceso" in source) result.estado_proceso = source.estado_proceso;
  if ("publicado_online" in source) result.publicado_online = Boolean(source.publicado_online);

  return result as PiezaDesguaceInput;
}

export function validatePieza(input: PiezaDesguaceInput) {
  const errors: string[] = [];
  if (input.estado_pieza && !ESTADOS_PIEZA.includes(input.estado_pieza)) errors.push("Estado de pieza no válido.");
  if (input.estado_proceso && !ESTADOS_PROCESO.includes(input.estado_proceso)) errors.push("Estado del proceso no válido.");
  if (input.ubicacion && !UBICACION_PATTERN.test(input.ubicacion)) errors.push("La ubicación debe tener el formato DESGUACE-E01-N03-C05.");
  for (const field of NUMBER_FIELDS) {
    const value = input[field];
    if (value !== null && value !== undefined && !Number.isFinite(value)) errors.push(`${field} debe ser numérico.`);
  }
  if (input.cantidad !== null && input.cantidad !== undefined && (!Number.isInteger(input.cantidad) || input.cantidad < 0)) errors.push("La cantidad debe ser un entero igual o mayor que cero.");
  if ((input.precio_coste ?? 0) < 0 || (input.precio_venta ?? 0) < 0) errors.push("Los precios no pueden ser negativos.");
  if (input.ano_desde && input.ano_hasta && input.ano_hasta < input.ano_desde) errors.push("El año hasta no puede ser anterior al año desde.");
  return errors;
}

export function validateReadyToPublish(input: PiezaDesguaceInput, photoCount: number) {
  const missing: string[] = [];
  if (!input.nombre_pieza) missing.push("nombre");
  if (!input.referencia_principal && !input.referencia_oem) missing.push("referencia");
  if (!input.estado_pieza) missing.push("estado");
  if (input.precio_venta === null || input.precio_venta === undefined) missing.push("precio");
  if (!input.ubicacion) missing.push("ubicación");
  if (input.cantidad === null || input.cantidad === undefined) missing.push("cantidad");
  if (photoCount < 1) missing.push("al menos una fotografía");
  return missing;
}

export function requiresPublishValidation(state?: EstadoProceso) {
  return state === "Lista para publicar" || state === "Publicada";
}
