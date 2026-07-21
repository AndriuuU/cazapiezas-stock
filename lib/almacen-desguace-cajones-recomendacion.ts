import type { CajonDesguace, PiezaDesguace } from "@/types/almacen-desguace";

const STOP_WORDS = new Set(["para", "del", "las", "los", "una", "uno", "con", "sin", "pieza", "piezas", "coche", "vehiculo", "desguace"]);

function normalize(value: string | null | undefined) {
  return (value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function terms(value: string) {
  return [...new Set(normalize(value).split(/[^a-z0-9]+/).filter((term) => term.length >= 3 && !STOP_WORDS.has(term)))];
}

export type RecomendacionCajon = {
  cajon: CajonDesguace;
  motivos: string[];
  coincidencias: string[];
  puntuacion: number;
};

export function recomendarCajon(piece: PiezaDesguace, drawers: CajonDesguace[]): RecomendacionCajon | null {
  const available = drawers.filter((drawer) => drawer.activo && !drawer.lleno && drawer.disponibles > 0 && drawer.id !== piece.cajon_id);
  if (!available.length) return null;

  const category = normalize(piece.categoria);
  const nameTerms = terms([piece.nombre_pieza, piece.categoria, piece.marca_pieza, piece.descripcion].filter(Boolean).join(" "));
  const ranked = available.map((drawer) => {
    const drawerText = normalize([drawer.nombre, drawer.descripcion, drawer.contenido_busqueda].filter(Boolean).join(" "));
    const matches = nameTerms.filter((term) => drawerText.includes(term));
    const categoryMatch = Boolean(category && drawerText.includes(category));
    const semanticScore = (categoryMatch ? 120 : 0) + matches.length * 25;
    const spaceScore = Math.round((drawer.disponibles / Math.max(1, drawer.capacidad_maxima)) * 10);
    const reasons = categoryMatch
      ? [`Coincide con la categoría ${piece.categoria}`]
      : matches.length
        ? [`Coincide con ${matches.slice(0, 3).join(", ")}`]
        : ["Es el cajón disponible con más espacio"];
    if (drawer.cantidad_piezas > 0 && semanticScore > 0) reasons.push("Ya contiene piezas parecidas");
    reasons.push(`${drawer.disponibles} espacios libres`);
    return { cajon: drawer, motivos: reasons, coincidencias: matches, puntuacion: semanticScore * 1000 + spaceScore * 10 + drawer.disponibles };
  });

  return ranked.sort((left, right) => right.puntuacion - left.puntuacion || left.cajon.codigo.localeCompare(right.cajon.codigo, "es"))[0] || null;
}
