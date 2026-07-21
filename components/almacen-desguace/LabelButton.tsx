"use client";

import { useState } from "react";
import QRCode from "qrcode";
import { Loader2, Printer } from "lucide-react";
import type { PiezaDesguace } from "@/types/almacen-desguace";

export default function LabelButton({ pieza }: { pieza: PiezaDesguace }) {
  const [busy, setBusy] = useState(false);
  async function print() {
    setBusy(true);
    try {
      const detailUrl = `${window.location.origin}/almacen-desguace/${pieza.id}`;
      const qr = await QRCode.toDataURL(detailUrl, { width: 480, margin: 2, errorCorrectionLevel: "H", color: { dark: "#000000", light: "#ffffff" } });
      const popup = window.open("", "_blank", "width=700,height=520");
      if (!popup) throw new Error("El navegador ha bloqueado la ventana de impresión.");
      const safe = (value: unknown) => String(value ?? "-").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]!));
      const vehicle = [pieza.marca_vehiculo, pieza.modelo_vehiculo].filter(Boolean).join(" ") || "Vehículo sin indicar";
      popup.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${safe(pieza.codigo_interno)}</title><style>@page{size:100mm 62mm;margin:3mm}*{box-sizing:border-box}body{margin:0;background:#fff;color:#000;font-family:Arial,sans-serif}.label{width:94mm;height:56mm;border:1.5px solid #000;border-radius:2mm;padding:3mm;display:grid;grid-template-columns:minmax(0,1fr) 38mm;gap:2.5mm}.info{min-width:0;display:flex;flex-direction:column}.kind{font-size:7pt;font-weight:800;letter-spacing:.8pt}.reference{font:900 18pt/1.05 monospace;margin:1.5mm 0 1mm;overflow-wrap:anywhere}.name{font-size:13pt;font-weight:900;line-height:1.08;max-height:14mm;overflow:hidden}.vehicle{margin-top:2mm;font-size:8.5pt;font-weight:700}.internal{margin-top:auto;border-top:.4mm solid #000;padding-top:1.5mm;font:700 8pt monospace}.brand{font-size:7pt;font-weight:900;margin-top:1mm}.qrbox{display:flex;flex-direction:column;align-items:center;justify-content:center;border-left:.4mm solid #000;padding-left:2.5mm}.qr{width:35mm;height:35mm;image-rendering:pixelated}.scan{margin-top:1mm;text-align:center;font-size:7.5pt;font-weight:900;line-height:1.15}.updated{margin-top:.8mm;text-align:center;font-size:6.5pt;line-height:1.1}@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}</style></head><body><div class="label"><div class="info"><div class="kind">PIEZA · ALMACÉN DESGUACE</div><div class="reference">${safe(pieza.referencia_principal || pieza.referencia_oem)}</div><div class="name">${safe(pieza.nombre_pieza || "Pieza sin identificar")}</div><div class="vehicle">${safe(vehicle)}</div><div class="internal">${safe(pieza.codigo_interno)}</div><div class="brand">CAZAPIEZAS</div></div><div class="qrbox"><img class="qr" src="${qr}" alt="QR de la pieza"><div class="scan">ESCANEAR PARA ABRIR LA FICHA</div><div class="updated">Ubicación y estado siempre actualizados</div></div></div><script>window.onload=()=>window.print()</script></body></html>`);
      popup.document.close();
    } catch (caught) { window.alert(caught instanceof Error ? caught.message : "No se pudo imprimir."); }
    finally { setBusy(false); }
  }
  return <button onClick={() => void print()} disabled={busy} className="inline-flex items-center gap-2 rounded-xl border border-zinc-700 px-4 py-2 font-semibold text-zinc-200 hover:bg-zinc-800 disabled:opacity-50">{busy ? <Loader2 size={17} className="animate-spin" /> : <Printer size={17} />} Imprimir etiqueta QR</button>;
}
