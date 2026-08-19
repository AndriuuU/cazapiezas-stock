"use client";

import { useState } from "react";
import { Loader2, Printer, QrCode } from "lucide-react";
import QRCode from "qrcode";
import { buildLocationManualCode, buildLocationQrPath, buildToolQrPath } from "@/lib/herramientas-comunes-qr";
import { openBrotherPrint } from "@/lib/print-bridge-client";
import type { EstanteriaHerramientas, HerramientaComun } from "@/types/herramientas-comunes";

export function ToolQrLabelButton({ tool, compact = false }: { tool: HerramientaComun; compact?: boolean }) {
  const [busy, setBusy] = useState(false);
  if (!tool.qr_token) return <p className="rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-xs font-bold text-amber-200">Falta activar los QR permanentes en la base de datos.</p>;
  async function print(destination: "browser" | "brother") {
    setBusy(true);
    try {
      const url = `${window.location.origin}${buildToolQrPath(tool.qr_token, tool.codigo)}`;
      const qr = await makeQr(url);
      const html = documentHtml(toolLabel(tool, qr));
      openPrint(html, destination);
    } catch (caught) { window.alert(caught instanceof Error ? caught.message : "No se pudo generar la etiqueta."); }
    finally { setBusy(false); }
  }
  const classes = compact ? "action" : "inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-cyan-500/30 px-4 font-bold text-cyan-200";
  return <div className="flex flex-wrap gap-2"><button type="button" disabled={busy} onClick={() => void print("brother")} className={classes}>{busy ? <Loader2 className="animate-spin" size={16} /> : <QrCode size={16} />} Etiqueta QR</button>{!compact && <button type="button" disabled={busy} onClick={() => void print("browser")} className={classes}><Printer size={16} /> PDF / otra impresora</button>}</div>;
}

export function ShelfLocationLabelsButton({ shelf, compact = false }: { shelf: EstanteriaHerramientas; compact?: boolean }) {
  const [busy, setBusy] = useState(false);
  async function print(destination: "browser" | "brother") {
    setBusy(true);
    try {
      const labels = await Promise.all(shelf.configuracion.filas.flatMap((row) => Array.from({ length: row.columnas }, async (_, index) => {
        const position = `C${index + 1}`;
        const url = `${window.location.origin}${buildLocationQrPath(shelf.id, row.nivel, position)}`;
        const qr = await makeQr(url);
        return locationLabel(shelf, row.nivel, row.nombre, position, row.columnas, qr);
      })));
      openPrint(documentHtml(labels.join("")), destination);
    } catch (caught) { window.alert(caught instanceof Error ? caught.message : "No se pudieron generar las etiquetas."); }
    finally { setBusy(false); }
  }
  const classes = compact ? "action" : "inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-amber-500/30 px-4 font-bold text-amber-200";
  return <div className="flex flex-wrap gap-2"><button type="button" disabled={busy} onClick={() => void print("brother")} className={classes}>{busy ? <Loader2 className="animate-spin" size={16} /> : <QrCode size={16} />} QR de todos los huecos</button>{!compact && <button type="button" disabled={busy} onClick={() => void print("browser")} className={classes}><Printer size={16} /> PDF / otra impresora</button>}</div>;
}

async function makeQr(value: string) {
  return QRCode.toDataURL(value, { width: 420, margin: 1, errorCorrectionLevel: "H", color: { dark: "#000000", light: "#ffffff" } });
}

function openPrint(html: string, destination: "browser" | "brother") {
  if (destination === "brother") { openBrotherPrint(html); return; }
  const popup = window.open("", "_blank", "width=760,height=600");
  if (!popup) throw new Error("El navegador ha bloqueado la ventana de impresión.");
  popup.document.write(html);
  popup.document.close();
}

function documentHtml(labels: string) {
  return `<!doctype html><html><head><meta charset="utf-8"><title>Etiquetas QR</title><style>@page{size:62mm 30mm;margin:0}*{box-sizing:border-box}body{margin:0;background:#fff;color:#000;font-family:Arial,sans-serif}.label{width:62mm;height:30mm;page-break-after:always;padding:2mm;display:grid;grid-template-columns:minmax(0,1fr) 25mm;gap:2mm;overflow:hidden}.info{min-width:0;display:flex;flex-direction:column}.kind{font-size:6pt;font-weight:900;letter-spacing:.5pt}.code{font:900 14pt/1 monospace;margin:1.4mm 0 1mm}.name{font-size:9pt;font-weight:900;line-height:1.05;max-height:9.5mm;overflow:hidden}.place{margin-top:1mm;font-size:6.5pt;font-weight:800;line-height:1.1}.brand{margin-top:auto;font-size:5.5pt;font-weight:900}.qrbox{display:flex;flex-direction:column;align-items:center;justify-content:center;border-left:.35mm solid #000;padding-left:1.5mm}.qr{width:21mm;height:21mm}.scan{font-size:5.5pt;font-weight:900;text-align:center}.label:last-child{page-break-after:auto}@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}</style></head><body>${labels}<script>window.onload=()=>window.print()</script></body></html>`;
}

function toolLabel(tool: HerramientaComun, qr: string) {
  return `<section class="label"><div class="info"><div class="kind">HERRAMIENTA COMÚN</div><div class="code">${safe(tool.codigo)}</div><div class="name">${safe(tool.nombre)}</div><div class="place">${safe(tool.estanteria?.zona)} · ${safe(tool.estanteria?.codigo)} · NIVEL ${tool.nivel}${tool.posicion !== "C1" ? ` · ${safe(tool.posicion)}` : ""}</div><div class="brand">CAZAPIEZAS</div></div><div class="qrbox"><img class="qr" src="${qr}" alt="QR"><div class="scan">ESCANEAR PARA USAR</div></div></section>`;
}

function locationLabel(shelf: EstanteriaHerramientas, level: number, rowName: string, position: string, columns: number, qr: string) {
  const manualCode = buildLocationManualCode(shelf.id, level, position);
  return `<section class="label"><div class="info"><div class="kind">UBICACIÓN · CÓDIGO MANUAL</div><div class="code">${safe(manualCode)}</div><div class="name">${safe(shelf.codigo)} · ${safe(rowName)}${columns > 1 ? ` · HUECO ${safe(position.slice(1))}` : ""}</div><div class="place">${safe(shelf.zona)} · ${safe(shelf.nombre)}</div><div class="brand">CAZAPIEZAS</div></div><div class="qrbox"><img class="qr" src="${qr}" alt="QR"><div class="scan">ESCANEAR O ESCRIBIR CÓDIGO</div></div></section>`;
}

function safe(value: unknown) {
  return String(value ?? "-").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!);
}
