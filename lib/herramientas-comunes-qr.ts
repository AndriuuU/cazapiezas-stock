export type CommonToolsQrValue =
  | { kind: "tool"; code: string }
  | { kind: "tool-token"; token: string }
  | { kind: "shelf"; shelfId: number }
  | { kind: "location"; shelfId: number; level: number; position: string }
  | { kind: "unknown"; value: string };

export function buildToolQrPath(qrToken: string | null | undefined, code: string) {
  if (qrToken) return `/herramientas-comunes?herramienta_qr=${encodeURIComponent(qrToken)}`;
  return `/herramientas-comunes?herramienta=${encodeURIComponent(code.trim())}`;
}

export function buildLocationQrPath(shelfId: number, level: number, position: string) {
  return `/herramientas-comunes?ubicacion=${encodeURIComponent(`${shelfId}:${level}:${normalizePosition(position)}`)}`;
}

export function buildShelfViewPath(shelfId: number) {
  return `/herramientas-comunes?estanteria=${encodeURIComponent(String(shelfId))}`;
}

export function buildLocationManualCode(shelfId: number, level: number, position: string) {
  return `UB-${shelfId}-N${level}-${normalizePosition(position)}`;
}

export function parseCommonToolsQr(rawValue: string, baseUrl = "https://cazapiezas.local") : CommonToolsQrValue {
  const value = rawValue.trim();
  if (!value) return { kind: "unknown", value };

  try {
    const url = new URL(value, baseUrl);
    const tool = url.searchParams.get("herramienta")?.trim();
    if (tool) return { kind: "tool", code: tool };
    const toolToken = url.searchParams.get("herramienta_qr")?.trim();
    if (toolToken) return { kind: "tool-token", token: toolToken };
    const shelfId = url.searchParams.get("estanteria")?.trim();
    if (shelfId && /^\d+$/.test(shelfId) && Number(shelfId) > 0) return { kind: "shelf", shelfId: Number(shelfId) };
    const location = url.searchParams.get("ubicacion");
    if (location) {
      const parsed = parseLocation(location);
      if (parsed) return parsed;
    }
  } catch { /* También aceptamos códigos escritos manualmente. */ }

  const prefixedTool = /^CP-TOOL:(.+)$/i.exec(value)?.[1]?.trim();
  if (prefixedTool) return { kind: "tool", code: prefixedTool };
  const prefixedLocation = /^CP-LOC:(.+)$/i.exec(value)?.[1]?.trim();
  if (prefixedLocation) {
    const parsed = parseLocation(prefixedLocation);
    if (parsed) return parsed;
  }
  const manualLocation = /^UB-(\d+)-N(\d+)-C(\d+)$/i.exec(value);
  if (manualLocation) return { kind: "location", shelfId: Number(manualLocation[1]), level: Number(manualLocation[2]), position: `C${Number(manualLocation[3])}` };
  return { kind: "tool", code: value };
}

function parseLocation(value: string): Extract<CommonToolsQrValue, { kind: "location" }> | null {
  const match = /^(\d+):(\d+):(C\d+)$/i.exec(value.trim());
  if (!match) return null;
  return { kind: "location", shelfId: Number(match[1]), level: Number(match[2]), position: normalizePosition(match[3]) };
}

export function normalizeQrPosition(value: string) {
  return normalizePosition(value);
}

function normalizePosition(value: string) {
  const match = /^C(\d+)$/i.exec(value.trim());
  return match ? `C${Number(match[1])}` : "C1";
}
