function textList(value: unknown) {
  const items = Array.isArray(value) ? value : String(value || "").split(",");
  return [...new Set(items.map((item) => String(item).trim()).filter(Boolean))];
}

export function normalizeShelf(value: unknown) {
  const source = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
  const levels = Math.max(1, Math.min(99, Number(source.niveles || 1)));
  const slots = Math.max(1, Math.min(99, Number(source.huecos_por_nivel || 1)));
  const maximum = source.capacidad_maxima === "" || source.capacidad_maxima === undefined
    ? levels * slots
    : Number(source.capacidad_maxima);
  return {
    codigo: String(source.codigo || "").trim().toUpperCase(),
    nombre: String(source.nombre || "").trim(),
    descripcion: String(source.descripcion || "").trim() || null,
    categorias: textList(source.categorias),
    palabras_clave: textList(source.palabras_clave),
    niveles: levels,
    huecos_por_nivel: slots,
    capacidad_maxima: maximum,
    llena_manual: Boolean(source.llena_manual),
    activa: source.activa === undefined ? true : Boolean(source.activa),
  };
}

export function validateShelf(shelf: ReturnType<typeof normalizeShelf>) {
  const errors: string[] = [];
  if (!/^E\d{2}$/.test(shelf.codigo)) errors.push("El código debe tener el formato E01.");
  if (!shelf.nombre) errors.push("Indica el nombre o contenido de la estantería.");
  if (!Number.isInteger(shelf.capacidad_maxima) || shelf.capacidad_maxima < 1 || shelf.capacidad_maxima > shelf.niveles * shelf.huecos_por_nivel) errors.push("La capacidad debe estar entre 1 y el número total de huecos.");
  return errors;
}
