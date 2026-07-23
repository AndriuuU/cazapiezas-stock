export const RECAMBIO_FACIL_REFERENCE_MIN_LENGTH = 4;

export type RecambioFacilRequiredFields = {
  nombrePieza?: unknown;
  marca?: unknown;
  modelo?: unknown;
  precio?: unknown;
  referenciaPrincipal?: unknown;
};

function clean(value: unknown) {
  return String(value ?? "").trim();
}

export function validateRecambioFacilRequiredFields(fields: RecambioFacilRequiredFields) {
  const errors: string[] = [];
  const reference = clean(fields.referenciaPrincipal);
  const rawPrice = clean(fields.precio);

  if (!clean(fields.nombrePieza)) errors.push("Nombre de la pieza");
  if (!reference) errors.push("Referencia principal");
  else if (reference.length < RECAMBIO_FACIL_REFERENCE_MIN_LENGTH) errors.push(`Referencia principal (mínimo ${RECAMBIO_FACIL_REFERENCE_MIN_LENGTH} caracteres)`);
  if (!rawPrice || !Number.isFinite(Number(rawPrice)) || Number(rawPrice) < 0) errors.push("Precio de venta válido");
  if (!clean(fields.marca)) errors.push("Marca del vehículo");
  if (!clean(fields.modelo)) errors.push("Modelo del vehículo");

  return errors;
}
