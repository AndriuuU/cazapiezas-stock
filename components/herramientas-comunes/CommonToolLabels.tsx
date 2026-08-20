"use client";

import { useState } from "react";
import { Loader2, Printer, QrCode } from "lucide-react";
import QRCode from "qrcode";
import { buildLocationManualCode, buildLocationQrPath, buildToolQrPath } from "@/lib/herramientas-comunes-qr";
import { openBrotherPrint } from "@/lib/print-bridge-client";
import type { EstanteriaHerramientas, HerramientaComun } from "@/types/herramientas-comunes";

type LabelSize = "small" | "standard" | "large";
const LABEL_SIZE_OPTIONS: Array<{ value: LabelSize; label: string }> = [
  { value: "small", label: "Pequeña · 62 × 32 mm" },
  { value: "standard", label: "Mediana · 62 × 42 mm" },
  { value: "large", label: "Grande · 100 × 62 mm" },
];

export function ToolQrLabelButton({ tool, compact = false }: { tool: HerramientaComun; compact?: boolean }) {
  const [busy, setBusy] = useState(false);
  const [size, setSize] = useState<LabelSize>("standard");
  if (!tool.qr_token) return <p className="rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-xs font-bold text-amber-200">Falta activar los QR permanentes en la base de datos.</p>;
  async function print(destination: "browser" | "brother") {
    setBusy(true);
    try {
      const url = `${window.location.origin}${buildToolQrPath(tool.qr_token, tool.codigo)}`;
      const qr = await makeQr(url);
      const html = documentHtml(toolLabel(tool, qr, size), size);
      openPrint(html, destination);
    } catch (caught) { window.alert(caught instanceof Error ? caught.message : "No se pudo generar la etiqueta."); }
    finally { setBusy(false); }
  }
  const classes = compact ? "action" : "inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-cyan-500/30 px-4 font-bold text-cyan-200";
  return <div className="flex flex-wrap gap-2"><LabelSizeSelect value={size} onChange={setSize} /><button type="button" disabled={busy} onClick={() => void print("brother")} className={classes}>{busy ? <Loader2 className="animate-spin" size={16} /> : <QrCode size={16} />} Etiqueta QR</button>{!compact && <button type="button" disabled={busy} onClick={() => void print("browser")} className={classes}><Printer size={16} /> PDF / otra impresora</button>}</div>;
}

export function ShelfLocationLabelsButton({ shelf, compact = false }: { shelf: EstanteriaHerramientas; compact?: boolean }) {
  const [busy, setBusy] = useState(false);
  const [size, setSize] = useState<LabelSize>("standard");
  async function print(destination: "browser" | "brother") {
    setBusy(true);
    try {
      const labels = await Promise.all(shelf.configuracion.filas.flatMap((row) => Array.from({ length: row.columnas }, async (_, index) => {
        const position = `C${index + 1}`;
        const url = `${window.location.origin}${buildLocationQrPath(shelf.id, row.nivel, position)}`;
        const qr = await makeQr(url);
        return locationLabel(shelf, row.nivel, row.nombre, position, row.columnas, qr, size);
      })));
      openPrint(documentHtml(labels.join(""), size), destination);
    } catch (caught) { window.alert(caught instanceof Error ? caught.message : "No se pudieron generar las etiquetas."); }
    finally { setBusy(false); }
  }
  const classes = compact ? "action" : "inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-amber-500/30 px-4 font-bold text-amber-200";
  return <div className="flex flex-wrap gap-2"><LabelSizeSelect value={size} onChange={setSize} /><button type="button" disabled={busy} onClick={() => void print("brother")} className={classes}>{busy ? <Loader2 className="animate-spin" size={16} /> : <QrCode size={16} />} QR de todos los huecos</button>{!compact && <button type="button" disabled={busy} onClick={() => void print("browser")} className={classes}><Printer size={16} /> PDF / otra impresora</button>}</div>;
}

function LabelSizeSelect({ value, onChange }: { value: LabelSize; onChange: (value: LabelSize) => void }) {
  return <label className="min-w-48"><span className="sr-only">Tamaño de la etiqueta</span><select value={value} onChange={(event) => onChange(event.target.value as LabelSize)} className="h-12 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 text-sm font-bold text-zinc-200 outline-none focus:border-cyan-400">{LABEL_SIZE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>;
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

function documentHtml(labels: string, size: LabelSize) {
  const layout = {
    small: { width: 62, height: 32, qr: 19, qrColumn: 21, code: 8.5, place: 5.5, equalColumns: false },
    standard: { width: 62, height: 42, qr: 22, qrColumn: 0, code: 12, place: 7, equalColumns: true },
    large: { width: 100, height: 62, qr: 40, qrColumn: 44, code: 16, place: 10, equalColumns: false },
  }[size];
  const grid = layout.equalColumns ? "grid-template-columns:minmax(0,1fr) minmax(0,1fr)" : `grid-template-columns:minmax(0,1fr) ${layout.qrColumn}mm`;
  return `<!doctype html><html><head><meta charset="utf-8"><title>Etiquetas QR</title><style>@page{size:${layout.width}mm ${layout.height}mm;margin:0}*{box-sizing:border-box}html,body{margin:0;width:${layout.width}mm;height:${layout.height}mm;background:#fff;color:#000;font-family:Arial,sans-serif}.label{width:${layout.width}mm;height:${layout.height}mm;page-break-after:always;padding:2.5mm 2.5mm 2.5mm 4mm;display:grid;${grid};gap:2mm;overflow:hidden}.info{min-width:0;min-height:0;display:flex;flex-direction:column;overflow:hidden}.name{min-height:0;font-family:"Arial Narrow",Arial,sans-serif;font-weight:900;line-height:.96;overflow-wrap:break-word;word-break:normal;margin:0 0 .8mm}.code{flex:0 0 auto;font:900 ${layout.code}pt/1 monospace;margin:.5mm 0;padding-bottom:.6mm;border-bottom:.35mm solid #000;white-space:nowrap}.place{flex:0 0 auto;margin-top:.6mm;font-size:${layout.place}pt;font-weight:800;line-height:1.02;overflow-wrap:break-word}.qrbox{display:flex;align-items:center;justify-content:center;border-left:.35mm solid #000;padding-left:1.5mm}.qr{display:block;width:${layout.qr}mm;height:${layout.qr}mm;image-rendering:pixelated}.label:last-child{page-break-after:auto}@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}</style></head><body>${labels}<script>window.onload=()=>window.print()</script></body></html>`;
}

function toolLabel(tool: HerramientaComun, qr: string, size: LabelSize) {
  const row = tool.estanteria?.configuracion?.filas?.find((item) => item.nivel === tool.nivel);
  const hasLocation = Boolean(tool.estanteria && tool.nivel != null && tool.posicion);
  const place = hasLocation ? `<div class="place">${safe(tool.estanteria?.zona)} · ${safe(tool.estanteria?.codigo)} · ${safe(row?.nombre || `NIVEL ${tool.nivel}`)}${row && row.columnas > 1 ? ` · HUECO ${safe(tool.posicion?.slice(1))}` : ""}</div>` : "";
  return `<section class="label"><div class="info"><div class="code">${safe(tool.codigo)}</div><div class="name" style="font-size:${nameFontSize(tool.nombre, size)}pt">${safe(tool.nombre)}</div>${place}</div><div class="qrbox"><img class="qr" src="${qr}" alt="QR"></div></section>`;
}

function locationLabel(shelf: EstanteriaHerramientas, level: number, rowName: string, position: string, columns: number, qr: string, size: LabelSize) {
  const manualCode = buildLocationManualCode(shelf.id, level, position);
  const name = `${shelf.codigo} · ${rowName}${columns > 1 ? ` · HUECO ${position.slice(1)}` : ""}`;
  return `<section class="label"><div class="info"><div class="code">${safe(manualCode)}</div><div class="name" style="font-size:${nameFontSize(name, size)}pt">${safe(name)}</div><div class="place">${safe(shelf.zona)} · ${safe(shelf.nombre)}</div></div><div class="qrbox"><img class="qr" src="${qr}" alt="QR"></div></section>`;
}

function nameFontSize(value: string, size: LabelSize) {
  const length = value.trim().length;
  if (size === "small") {
    if (length > 90) return 5.2;
    if (length > 65) return 5.8;
    if (length > 48) return 6.6;
    if (length > 32) return 7.6;
    if (length > 20) return 9.5;
    return 12.5;
  }
  const multiplier = size === "large" ? 1.35 : size === "standard" ? 1.15 : 1;
  if (length > 90) return 7.5 * multiplier;
  if (length > 65) return 8.5 * multiplier;
  if (length > 48) return 10 * multiplier;
  if (length > 32) return 12 * multiplier;
  if (length > 20) return 15 * multiplier;
  return 19 * multiplier;
}

function safe(value: unknown) {
  return String(value ?? "-").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!);
}
