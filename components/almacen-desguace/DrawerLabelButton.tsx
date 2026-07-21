"use client";

import { useState } from "react";
import QRCode from "qrcode";
import { Loader2, Printer } from "lucide-react";
import type { CajonDesguace } from "@/types/almacen-desguace";

function safe(value: unknown) {
  return String(value ?? "-").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);
}

export default function DrawerLabelButton({ drawer }: { drawer: CajonDesguace }) {
  const [busy, setBusy] = useState(false);
  async function print() {
    setBusy(true);
    try {
      const detailUrl = `${window.location.origin}/almacen-desguace/cajones/${drawer.id}`;
      const qr = await QRCode.toDataURL(detailUrl, { width: 480, margin: 2, errorCorrectionLevel: "H", color: { dark: "#000000", light: "#ffffff" } });
      const popup = window.open("", "_blank", "width=700,height=520");
      if (!popup) throw new Error("El navegador ha bloqueado la ventana de impresión.");
      popup.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${safe(drawer.codigo)}</title><style>@page{size:100mm 62mm;margin:3mm}*{box-sizing:border-box}body{margin:0;background:#fff;color:#000;font-family:Arial,sans-serif}.label{width:94mm;height:56mm;border:1.5px solid #000;border-radius:2mm;padding:3mm;display:grid;grid-template-columns:minmax(0,1fr) 38mm;gap:2.5mm}.info{min-width:0;display:flex;flex-direction:column}.kind{font-size:8pt;font-weight:900;letter-spacing:1pt}.code{font:900 23pt/1 monospace;margin:3mm 0 2mm;overflow-wrap:anywhere}.name{font-size:15pt;font-weight:900;line-height:1.08;max-height:18mm;overflow:hidden}.note{margin-top:auto;border-top:.4mm solid #000;padding-top:1.5mm;font-size:7.5pt;font-weight:700;line-height:1.2}.brand{font-size:7pt;font-weight:900;margin-top:1mm}.qrbox{display:flex;flex-direction:column;align-items:center;justify-content:center;border-left:.4mm solid #000;padding-left:2.5mm}.qr{width:35mm;height:35mm;image-rendering:pixelated}.scan{margin-top:1mm;text-align:center;font-size:7.5pt;font-weight:900;line-height:1.15}.updated{margin-top:.8mm;text-align:center;font-size:6.5pt;line-height:1.1}@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}</style></head><body><div class="label"><div class="info"><div class="kind">CAJÓN · ALMACÉN DESGUACE</div><div class="code">${safe(drawer.codigo)}</div><div class="name">${safe(drawer.nombre)}</div><div class="note">Escanea el QR para consultar todas sus piezas.</div><div class="brand">CAZAPIEZAS</div></div><div class="qrbox"><img class="qr" src="${qr}" alt="QR del cajón"><div class="scan">ESCANEAR PARA ABRIR EL CAJÓN</div><div class="updated">Contenido, ubicación y estado actualizados</div></div></div><script>window.onload=()=>window.print()</script></body></html>`);
      popup.document.close();
    } catch (caught) { window.alert(caught instanceof Error ? caught.message : "No se pudo imprimir la etiqueta."); }
    finally { setBusy(false); }
  }
  return <button onClick={() => void print()} disabled={busy} className="inline-flex items-center gap-2 rounded-xl border border-zinc-700 px-4 py-2.5 font-bold text-zinc-200 hover:bg-zinc-800 disabled:opacity-50">{busy ? <Loader2 size={17} className="animate-spin" /> : <Printer size={17} />} Etiqueta QR</button>;
}
