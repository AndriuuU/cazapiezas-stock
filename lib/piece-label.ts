import { code128Svg, normalizeCode128Value } from "@/lib/code128";
import type { PiezaDesguace } from "@/types/almacen-desguace";

export type PieceLabelFormat = "normal" | "compact";

export function buildPieceLabelHtml(piece: PiezaDesguace, logoUrl: string, format: PieceLabelFormat = "normal") {
  return buildLabelDocument(piece, logoUrl, format, true);
}

export function buildPieceLabelPreviewHtml(piece: PiezaDesguace, logoUrl: string, format: PieceLabelFormat) {
  return buildLabelDocument(piece, logoUrl, format, false);
}

function buildLabelDocument(piece: PiezaDesguace, logoUrl: string, format: PieceLabelFormat, autoPrint: boolean) {
  const barcodeReference = piece.referencia_principal?.trim() || piece.referencia_oem?.trim() || piece.codigo_interno;
  const normalizedBarcodeReference = normalizeCode128Value(barcodeReference);
  const barcode = code128Svg(normalizedBarcodeReference);
  const vehicle = [piece.marca_vehiculo, piece.modelo_vehiculo].filter(Boolean).join(" ") || "Vehículo sin indicar";
  const compact = format === "compact";
  const height = compact ? 30 : 42;
  const printableHeight = height - 4;
  const padding = compact ? 1.5 : 1.8;
  const barcodeHeight = compact ? 10 : 11.5;

  return `<!doctype html><html><head><meta charset="utf-8"><title>${safe(piece.codigo_interno)}</title><style>
@page{size:62mm ${height}mm;margin:2mm}
*{box-sizing:border-box}
body{margin:0;background:#fff;color:#000;font-family:Arial,sans-serif;${autoPrint ? "" : `width:62mm;height:${height}mm;padding:2mm;overflow:hidden`}}
.label{width:58mm;height:${printableHeight}mm;border:.4mm solid #000;border-radius:1.5mm;padding:${padding}mm;display:grid;grid-template-rows:minmax(0,1fr) ${barcodeHeight}mm}
.info{position:relative;min-width:0;display:flex;flex-direction:column;overflow:hidden;padding-right:${compact ? 9.5 : 13.5}mm}
.logo{position:absolute;top:0;right:0;width:${compact ? 8 : 11.5}mm;height:${compact ? 8 : 11.5}mm;object-fit:contain}
.kind{font-size:${compact ? 4.2 : 4.8}pt;font-weight:800;letter-spacing:.35pt}
.reference{font:900 ${compact ? 10.5 : 13.5}pt/1.02 monospace;margin:${compact ? ".5mm 0 .3mm" : ".8mm 0 .5mm"};overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.name{font-size:${compact ? 7.2 : 8.5}pt;font-weight:900;line-height:1.05;max-height:${compact ? 4 : 5.5}mm;overflow:hidden}
.vehicle{margin-top:.5mm;font-size:6pt;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.internal{margin-top:auto;font:700 ${compact ? 4.8 : 5.5}pt monospace;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.brand{font-size:5pt;font-weight:900}
.barcodebox{display:grid;grid-template-columns:minmax(0,1fr) auto;grid-template-rows:${compact ? 7.2 : 8.5}mm ${compact ? 2 : 2.2}mm;column-gap:1mm;align-items:center;border-top:.3mm solid #000;padding-top:.6mm;overflow:hidden}
.barcode{grid-column:1/-1;width:100%;height:${compact ? 7 : 8.3}mm}
.barcode svg{display:block;width:100%;height:100%}
.barcodetext{grid-column:1;font:900 ${compact ? 5.2 : 5.8}pt/1 monospace;letter-spacing:.35pt;text-align:center;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.barcodehint{grid-column:2;font-size:${compact ? 4.2 : 4.7}pt;font-weight:900;white-space:nowrap}
@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
</style></head><body><div class="label"><div class="info"><img class="logo" src="${safe(logoUrl)}" alt="Cazapiezas"><div class="kind">PIEZA · ALMACÉN DESGUACE</div><div class="reference">${safe(piece.referencia_principal || piece.referencia_oem || piece.codigo_interno)}</div><div class="name">${safe(piece.nombre_pieza || "Pieza sin identificar")}</div>${compact ? "" : `<div class="vehicle">${safe(vehicle)}</div>`}<div class="internal">${safe(piece.codigo_interno)}</div>${compact ? "" : `<div class="brand">CAZAPIEZAS</div>`}</div><div class="barcodebox"><div class="barcode">${barcode}</div><div class="barcodetext">${safe(normalizedBarcodeReference)}</div><div class="barcodehint">REFERENCIA</div></div></div>${autoPrint ? "<script>window.onload=()=>window.print()</script>" : ""}</body></html>`;
}

function safe(value: unknown) {
  return String(value ?? "-").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character]!);
}
