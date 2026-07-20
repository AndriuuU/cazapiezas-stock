function textList(value: unknown) {
  const items = Array.isArray(value) ? value : String(value || "").split(",");
  return [...new Set(items.map((item) => String(item).trim()).filter(Boolean))];
}

function levelRules(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => {
    const source = (item && typeof item === "object" ? item : {}) as Record<string, unknown>;
    return {
      nivel_desde: Number(source.nivel_desde),
      nivel_hasta: Number(source.nivel_hasta),
      contenido: String(source.contenido || "").trim(),
      categorias: textList(source.categorias),
      palabras_clave: textList(source.palabras_clave),
    };
  });
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
    zona: String(source.zona || "Sin zona").trim().slice(0, 80) || "Sin zona",
    orden_plano: Math.max(0, Math.min(9999, Math.trunc(Number(source.orden_plano) || 0))),
    categorias: textList(source.categorias),
    palabras_clave: textList(source.palabras_clave),
    reglas_nivel: levelRules(source.reglas_nivel),
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
  if (!shelf.zona) errors.push("Indica la zona o pasillo de la estantería.");
  if (!Number.isInteger(shelf.capacidad_maxima) || shelf.capacidad_maxima < 1 || shelf.capacidad_maxima > shelf.niveles * shelf.huecos_por_nivel) errors.push("La capacidad debe estar entre 1 y el número total de huecos.");
  const assignedLevels = new Set<number>();
  shelf.reglas_nivel.forEach((rule, index) => {
    const label = `Grupo ${index + 1}`;
    if (!Number.isInteger(rule.nivel_desde) || !Number.isInteger(rule.nivel_hasta) || rule.nivel_desde < 1 || rule.nivel_hasta > shelf.niveles || rule.nivel_desde > rule.nivel_hasta) {
      errors.push(`${label}: indica un intervalo de niveles válido entre 1 y ${shelf.niveles}.`);
      return;
    }
    if (!rule.contenido && !rule.categorias.length && !rule.palabras_clave.length) errors.push(`${label}: indica qué piezas van en esos niveles.`);
    for (let level = rule.nivel_desde; level <= rule.nivel_hasta; level++) {
      if (assignedLevels.has(level)) errors.push(`El nivel ${level} aparece en más de un grupo.`);
      assignedLevels.add(level);
    }
  });
  return [...new Set(errors)];
}
