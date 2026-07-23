import { code128Svg, normalizeCode128Value } from "@/lib/code128";
import type { PiezaDesguace } from "@/types/almacen-desguace";

export function buildPieceLabelHtml(piece: PiezaDesguace, qrDataUrl: string) {
  const barcodeReference = piece.referencia_principal?.trim() || piece.referencia_oem?.trim() || piece.codigo_interno;
  const normalizedBarcodeReference = normalizeCode128Value(barcodeReference);
  const barcode = code128Svg(normalizedBarcodeReference);
  const vehicle = [piece.marca_vehiculo, piece.modelo_vehiculo].filter(Boolean).join(" ") || "Vehículo sin indicar";

  return `<!doctype html><html><head><meta charset="utf-8"><title>${safe(piece.codigo_interno)}</title><style>
@page{size:100mm 62mm;margin:3mm}
*{box-sizing:border-box}
body{margin:0;background:#fff;color:#000;font-family:Arial,sans-serif}
.label{width:94mm;height:56mm;border:1.5px solid #000;border-radius:2mm;padding:2.5mm;display:grid;grid-template-columns:minmax(0,1fr) 29mm;grid-template-rows:minmax(0,1fr) 14mm;column-gap:2.5mm}
.info{min-width:0;display:flex;flex-direction:column;overflow:hidden}
.kind{font-size:6.5pt;font-weight:800;letter-spacing:.7pt}
.reference{font:900 16pt/1.05 monospace;margin:1mm 0 .7mm;overflow-wrap:anywhere}
.name{font-size:11.5pt;font-weight:900;line-height:1.05;max-height:9mm;overflow:hidden}
.vehicle{margin-top:1mm;font-size:7.5pt;font-weight:700}
.internal{margin-top:auto;font:700 7pt monospace}
.brand{font-size:6.5pt;font-weight:900}
.qrbox{display:flex;flex-direction:column;align-items:center;justify-content:center;border-left:.4mm solid #000;padding-left:2mm}
.qr{width:25mm;height:25mm;image-rendering:pixelated}
.scan{margin-top:.7mm;text-align:center;font-size:6.3pt;font-weight:900;line-height:1.1}
.barcodebox{grid-column:1/-1;display:grid;grid-template-columns:minmax(0,1fr) auto;grid-template-rows:9.5mm 3mm;column-gap:2mm;align-items:center;border-top:.4mm solid #000;padding-top:1mm;overflow:hidden}
.barcode{grid-column:1/-1;width:100%;height:9mm}
.barcode svg{display:block;width:100%;height:100%}
.barcodetext{grid-column:1;font:900 7.5pt/1 monospace;letter-spacing:.8pt;text-align:center;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.barcodehint{grid-column:2;font-size:5.8pt;font-weight:900;white-space:nowrap}
@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
</style></head><body><div class="label"><div class="info"><div class="kind">PIEZA · ALMACÉN DESGUACE</div><div class="reference">${safe(piece.referencia_principal || piece.referencia_oem || piece.codigo_interno)}</div><div class="name">${safe(piece.nombre_pieza || "Pieza sin identificar")}</div><div class="vehicle">${safe(vehicle)}</div><div class="internal">${safe(piece.codigo_interno)}</div><div class="brand">CAZAPIEZAS</div></div><div class="qrbox"><img class="qr" src="${safe(qrDataUrl)}" alt="QR de la pieza"><div class="scan">QR · ABRIR FICHA</div></div><div class="barcodebox"><div class="barcode">${barcode}</div><div class="barcodetext">${safe(normalizedBarcodeReference)}</div><div class="barcodehint">REFERENCIA</div></div></div><script>window.onload=()=>window.print()</script></body></html>`;
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
