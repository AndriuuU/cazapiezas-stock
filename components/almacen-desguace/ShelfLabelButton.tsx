"use client";

import { useState } from "react";
import { Loader2, Printer } from "lucide-react";
import QRCode from "qrcode";
import { openBrotherPrint } from "@/lib/print-bridge-client";
import type { EstanteriaDesguace } from "@/types/almacen-desguace";

type ShelfLabel = Pick<EstanteriaDesguace, "id" | "codigo" | "nombre" | "zona">;

export default function ShelfLabelButton({ shelf, compact = false }: { shelf: ShelfLabel; compact?: boolean }) {
  const [busy, setBusy] = useState(false);

  async function print(destination: "browser" | "brother") {
    setBusy(true);
    try {
      const detailUrl = `${window.location.origin}/almacen-desguace/estanterias/${shelf.id}`;
      const qr = await QRCode.toDataURL(detailUrl, { width: 480, margin: 2, errorCorrectionLevel: "H", color: { dark: "#000000", light: "#ffffff" } });
      const html = `<!doctype html><html><head><meta charset="utf-8"><title>${safe(shelf.codigo)}</title><style>@page{size:100mm 62mm;margin:3mm}*{box-sizing:border-box}body{margin:0;background:#fff;color:#000;font-family:Arial,sans-serif}.label{width:94mm;height:56mm;border:1.5px solid #000;border-radius:2mm;padding:3mm;display:grid;grid-template-columns:minmax(0,1fr) 38mm;gap:2.5mm}.info{min-width:0;display:flex;flex-direction:column}.kind{font-size:8pt;font-weight:900;letter-spacing:1pt}.code{font:900 25pt/1 monospace;margin:3mm 0 2mm}.name{font-size:15pt;font-weight:900;line-height:1.08;max-height:18mm;overflow:hidden}.zone{margin-top:1.5mm;font-size:9pt;font-weight:800}.note{margin-top:auto;border-top:.4mm solid #000;padding-top:1.5mm;font-size:7.5pt;font-weight:700;line-height:1.2}.brand{font-size:7pt;font-weight:900;margin-top:1mm}.qrbox{display:flex;flex-direction:column;align-items:center;justify-content:center;border-left:.4mm solid #000;padding-left:2.5mm}.qr{width:35mm;height:35mm;image-rendering:pixelated}.scan{margin-top:1mm;text-align:center;font-size:7.5pt;font-weight:900;line-height:1.15}.updated{margin-top:.8mm;text-align:center;font-size:6.5pt;line-height:1.1}@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}</style></head><body><div class="label"><div class="info"><div class="kind">ESTANTERÍA · ALMACÉN DESGUACE</div><div class="code">${safe(shelf.codigo)}</div><div class="name">${safe(shelf.nombre)}</div><div class="zone">${safe(shelf.zona || "Sin zona")}</div><div class="note">Escanea el QR para consultar niveles, huecos, piezas y cajones.</div><div class="brand">CAZAPIEZAS</div></div><div class="qrbox"><img class="qr" src="${qr}" alt="QR de la estantería"><div class="scan">ABRIR FICHA DE LA ESTANTERÍA</div><div class="updated">Ocupación y contenido siempre actualizados</div></div></div><script>window.onload=()=>window.print()</script></body></html>`;
      if (destination === "brother") openBrotherPrint(html);
      else {
        const popup = window.open("", "_blank", "width=760,height=600");
        if (!popup) throw new Error("El navegador ha bloqueado la ventana de impresión.");
        popup.document.write(html);
        popup.document.close();
      }
    } catch (caught) {
      window.alert(caught instanceof Error ? caught.message : "No se pudo generar la etiqueta QR.");
    } finally {
      setBusy(false);
    }
  }

  const buttonClass = compact ? "inline-flex items-center gap-1 rounded-lg border border-cyan-500/30 px-3 py-2 text-sm font-bold text-cyan-300 hover:bg-cyan-500/10 disabled:opacity-50" : "inline-flex items-center gap-2 rounded-xl border border-cyan-500/30 px-4 py-2.5 font-bold text-cyan-200 hover:bg-cyan-500/10 disabled:opacity-50";
  return <div className="flex flex-wrap gap-2"><button type="button" onClick={() => void print("browser")} disabled={busy} className={buttonClass}>{busy ? <Loader2 size={16} className="animate-spin" /> : <Printer size={16} />} Etiqueta QR</button><button type="button" onClick={() => void print("brother")} disabled={busy} className={buttonClass}><Printer size={16} /> Brother Wi-Fi</button></div>;
}

function safe(value: unknown) {
  return String(value ?? "-").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!);
}
