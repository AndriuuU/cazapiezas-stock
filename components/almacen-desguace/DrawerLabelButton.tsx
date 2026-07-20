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
      const qr = await QRCode.toDataURL(detailUrl, { width: 300, margin: 1, errorCorrectionLevel: "M" });
      const popup = window.open("", "_blank", "width=700,height=520");
      if (!popup) throw new Error("El navegador ha bloqueado la ventana de impresión.");
      popup.document.write(`<!doctype html><html><head><title>${safe(drawer.codigo)}</title><style>@page{size:100mm 62mm;margin:3mm}*{box-sizing:border-box}body{margin:0;font-family:Arial,sans-serif}.label{width:94mm;height:56mm;border:1px solid #111;padding:4mm;display:grid;grid-template-columns:1fr 34mm;gap:3mm}.code{font:900 18pt monospace}.name{font-size:14pt;font-weight:800;margin:3mm 0}.line{font-size:10pt;margin:1.5mm 0}.qr{width:32mm;height:32mm}.brand{font-size:8pt;font-weight:800;margin-top:3mm}@media print{button{display:none}}</style></head><body><div class="label"><div><div class="code">${safe(drawer.codigo)}</div><div class="name">${safe(drawer.nombre)}</div><div class="line"><b>Ubicación</b> ${safe(drawer.ubicacion)}</div><div class="line"><b>Contenido</b> ${drawer.cantidad_piezas} / ${drawer.capacidad_maxima} piezas</div><div class="line"><b>Estado</b> ${drawer.lleno ? "LLENO" : `${drawer.disponibles} espacios libres`}</div><div class="brand">CAZAPIEZAS · ALMACÉN DESGUACE</div></div><div><img class="qr" src="${qr}" alt="QR"><div style="font-size:7pt;text-align:center">Consultar cajón</div></div></div><script>window.onload=()=>window.print()</script></body></html>`);
      popup.document.close();
    } catch (caught) { window.alert(caught instanceof Error ? caught.message : "No se pudo imprimir la etiqueta."); }
    finally { setBusy(false); }
  }
  return <button onClick={() => void print()} disabled={busy} className="inline-flex items-center gap-2 rounded-xl border border-zinc-700 px-4 py-2.5 font-bold text-zinc-200 hover:bg-zinc-800 disabled:opacity-50">{busy ? <Loader2 size={17} className="animate-spin" /> : <Printer size={17} />} Etiqueta QR</button>;
}
