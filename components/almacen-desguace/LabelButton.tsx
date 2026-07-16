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
      const qr = await QRCode.toDataURL(detailUrl, { width: 280, margin: 1, errorCorrectionLevel: "M" });
      const popup = window.open("", "_blank", "width=700,height=520");
      if (!popup) throw new Error("El navegador ha bloqueado la ventana de impresión.");
      const safe = (value: unknown) => String(value ?? "-").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]!));
      popup.document.write(`<!doctype html><html><head><title>${safe(pieza.codigo_interno)}</title><style>@page{size:100mm 62mm;margin:3mm}*{box-sizing:border-box}body{margin:0;font-family:Arial,sans-serif}.label{width:94mm;height:56mm;border:1px solid #111;padding:4mm;display:grid;grid-template-columns:1fr 34mm;gap:3mm}.code{font:700 10pt monospace}.name{font-size:16pt;font-weight:800;margin:3mm 0}.line{font-size:10pt;margin:1.5mm 0}.qr{width:32mm;height:32mm}.brand{font-size:8pt;font-weight:800;margin-top:2mm}@media print{button{display:none}}</style></head><body><div class="label"><div><div class="code">${safe(pieza.codigo_interno)}</div><div class="name">${safe(pieza.nombre_pieza)}</div><div class="line"><b>Ref.</b> ${safe(pieza.referencia_principal || pieza.referencia_oem)}</div><div class="line"><b>Ubicación</b> ${safe(pieza.ubicacion)}</div><div class="line"><b>Estado</b> ${safe(pieza.estado_pieza)}</div><div class="brand">CAZAPIEZAS · ALMACÉN DESGUACE</div></div><div><img class="qr" src="${qr}" alt="QR"><div style="font-size:7pt;text-align:center">Abrir ficha</div></div></div><script>window.onload=()=>{window.print()}</script></body></html>`);
      popup.document.close();
    } catch (caught) { window.alert(caught instanceof Error ? caught.message : "No se pudo imprimir."); }
    finally { setBusy(false); }
  }
  return <button onClick={() => void print()} disabled={busy} className="inline-flex items-center gap-2 rounded-xl border border-zinc-700 px-4 py-2 font-semibold text-zinc-200 hover:bg-zinc-800 disabled:opacity-50">{busy ? <Loader2 size={17} className="animate-spin" /> : <Printer size={17} />} Imprimir etiqueta QR</button>;
}
