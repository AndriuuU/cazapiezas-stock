import type { ConfiguracionEstanteriaHerramientas, FilaEstanteriaHerramientas } from "@/types/herramientas-comunes";

export function normalizeShelfConfiguration(value: unknown): ConfiguracionEstanteriaHerramientas {
  const source = value && typeof value === "object" && Array.isArray((value as { filas?: unknown }).filas)
    ? (value as { filas: unknown[] }).filas
    : [];
  const rows = source.slice(0, 30).map((item, index) => {
    const row = item && typeof item === "object" ? item as Partial<FilaEstanteriaHerramientas> : {};
    return {
      nivel: source.length - index,
      nombre: String(row.nombre || `Nivel ${source.length - index}`).trim().slice(0, 50),
      tipo: row.tipo === "colgador" ? "colgador" as const : "balda" as const,
      columnas: Math.min(12, Math.max(1, Math.round(Number(row.columnas) || 1))),
      altura: Math.min(4, Math.max(1, Math.round(Number(row.altura) || 1))),
    };
  });
  return { filas: rows };
}

export function shelfPositionExists(configuration: ConfiguracionEstanteriaHerramientas | null | undefined, level: number, position: string) {
  const row = configuration?.filas?.find((item) => item.nivel === level);
  if (!row) return false;
  const column = Number(/^C(\d+)$/i.exec(position)?.[1] || 0);
  return column >= 1 && column <= row.columnas;
}
