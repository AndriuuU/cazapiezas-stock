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
  async function printNameAndCode() {
    setBusy(true);
    try {
      openPrint(nameAndCodeDocument(tool), "brother");
    } catch (caught) { window.alert(caught instanceof Error ? caught.message : "No se pudo generar la etiqueta con el nombre."); }
    finally { setBusy(false); }
  }
  const classes = compact ? "action" : "inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-cyan-500/30 px-4 font-bold text-cyan-200";
  return <div className="flex flex-wrap gap-2"><LabelSizeSelect value={size} onChange={setSize} /><button type="button" disabled={busy} onClick={() => void print("brother")} className={classes}>{busy ? <Loader2 className="animate-spin" size={16} /> : <QrCode size={16} />} Etiqueta QR</button><button type="button" disabled={busy} onClick={() => void printNameAndCode()} className={classes}><Printer size={16} /> Nombre + código · pequeña</button>{!compact && <button type="button" disabled={busy} onClick={() => void print("browser")} className={classes}><Printer size={16} /> PDF / otra impresora</button>}</div>;
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
  async function printA4() {
    setBusy(true);
    try {
      const locations = await Promise.all(shelf.configuracion.filas.flatMap((row) => Array.from({ length: row.columnas }, async (_, index) => {
        const position = `C${index + 1}`;
        const url = `${window.location.origin}${buildLocationQrPath(shelf.id, row.nivel, position)}`;
        return { rowName: row.nombre, position, columns: row.columnas, manualCode: buildLocationManualCode(shelf.id, row.nivel, position), qr: await makeQr(url) };
      })));
      openPrint(a4ShelfDocument(shelf, locations), "browser");
    } catch (caught) { window.alert(caught instanceof Error ? caught.message : "No se pudo preparar el folio A4."); }
    finally { setBusy(false); }
  }
  const classes = compact ? "action" : "inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-amber-500/30 px-4 font-bold text-amber-200";
  return <div className="flex flex-wrap gap-2"><LabelSizeSelect value={size} onChange={setSize} /><button type="button" disabled={busy} onClick={() => void print("brother")} className={classes}>{busy ? <Loader2 className="animate-spin" size={16} /> : <QrCode size={16} />} QR de todos los huecos</button>{!compact && <button type="button" disabled={busy} onClick={() => void print("browser")} className={classes}><Printer size={16} /> Etiquetas individuales</button>}<button type="button" disabled={busy} onClick={() => void printA4()} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-violet-500/30 bg-violet-500/10 px-4 font-bold text-violet-200"><Printer size={16} /> Folio A4 para la puerta</button></div>;
}

function LabelSizeSelect({ value, onChange }: { value: LabelSize; onChange: (value: LabelSize) => void }) {
  return <label className="min-w-48"><span className="sr-only">Tamaño de la etiqueta</span><select value={value} onChange={(event) => onChange(event.target.value as LabelSize)} className="h-12 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 text-sm font-bold text-zinc-200 outline-none focus:border-cyan-400">{LABEL_SIZE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>;
}

async function makeQr(value: string) {
  // Un borde blanco amplio y una matriz menos densa mejoran mucho la lectura
  // con Safari/iPhone, especialmente en las etiquetas pequeñas.
  return QRCode.toDataURL(value, { width: 420, margin: 4, errorCorrectionLevel: "M", color: { dark: "#000000", light: "#ffffff" } });
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
    standard: { width: 62, height: 42, qr: 22, qrColumn: 0, code: 11, place: 5.5, equalColumns: true },
    large: { width: 100, height: 62, qr: 40, qrColumn: 44, code: 16, place: 10, equalColumns: false },
  }[size];
  const grid = layout.equalColumns ? "grid-template-columns:minmax(0,1fr) minmax(0,1fr)" : `grid-template-columns:minmax(0,1fr) ${layout.qrColumn}mm`;
  return `<!doctype html><html><head><meta charset="utf-8"><title>Etiquetas QR</title><style>@page{size:${layout.width}mm ${layout.height}mm;margin:0}*{box-sizing:border-box}html,body{margin:0;width:${layout.width}mm;height:${layout.height}mm;background:#fff;color:#000;font-family:Arial,sans-serif}.label{width:${layout.width}mm;height:${layout.height}mm;page-break-after:always;padding:2.5mm 2.5mm 2.5mm 4mm;display:grid;${grid};gap:2mm;overflow:hidden}.info{min-width:0;min-height:0;display:flex;flex-direction:column;overflow:hidden}.name{min-height:0;font-family:"Arial Narrow",Arial,sans-serif;font-weight:900;line-height:.96;overflow-wrap:break-word;word-break:normal;margin:0 0 .8mm}.code{flex:0 0 auto;font:900 ${layout.code}pt/1 monospace;margin:.5mm 0;padding-bottom:.6mm;border-bottom:.35mm solid #000;white-space:nowrap}.place{flex:0 0 auto;margin-top:.6mm;font-size:${layout.place}pt;font-weight:800;line-height:1.02;overflow-wrap:break-word}.qrbox{display:flex;align-items:center;justify-content:center;border-left:.35mm solid #000;padding-left:1.5mm}.qr{display:block;width:${layout.qr}mm;height:${layout.qr}mm;image-rendering:pixelated}.label:last-child{page-break-after:auto}@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}</style></head><body>${labels}<script>window.onload=()=>window.print()</script></body></html>`;
}

function nameAndCodeDocument(tool: HerramientaComun) {
  const fallbackFontSize = nameAndCodeFallbackFontSize(tool.nombre);
  return `<!doctype html><html><head><meta charset="utf-8"><title>${safe(tool.codigo)} · ${safe(tool.nombre)}</title><style>@page{size:62mm 32mm;margin:0}*{box-sizing:border-box}html,body{margin:0;width:62mm;height:32mm;background:#fff;color:#000;font-family:Arial,sans-serif}.label{width:62mm;height:32mm;padding:2.5mm 3mm 2.5mm 4mm;display:flex;flex-direction:column;overflow:hidden}.code{flex:0 0 auto;margin:0 0 1.5mm;padding-bottom:1mm;border-bottom:.45mm solid #000;font:900 12pt/1 monospace;white-space:nowrap}.name-box{flex:1;min-width:0;min-height:0;display:flex;align-items:center}.name{display:block;width:100%;margin:0;font-family:"Arial Narrow",Arial,sans-serif;font-size:${fallbackFontSize}pt;font-weight:900;line-height:1;white-space:normal;overflow-wrap:normal;word-break:normal;hyphens:none}@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}</style></head><body><section class="label"><div class="code">${safe(tool.codigo)}</div><div class="name-box"><div class="name" data-fit-name data-max-font="42">${safe(tool.nombre)}</div></div></section><script>window.onload=()=>{const name=document.querySelector('[data-fit-name]');const box=name.parentElement;let size=42;name.style.fontSize=size+'pt';while(size>2&&(name.scrollHeight>box.clientHeight||name.scrollWidth>box.clientWidth)){size-=.25;name.style.fontSize=size+'pt'}requestAnimationFrame(()=>window.print())}</script></body></html>`;
}

function nameAndCodeFallbackFontSize(value: string) {
  const length = value.trim().length;
  const longestWord = Math.max(0, ...value.trim().split(/\s+/).map((word) => word.length));
  let size = length > 120 ? 5 : length > 90 ? 6 : length > 65 ? 8 : length > 45 ? 10.5 : length > 30 ? 14 : length > 20 ? 17 : length > 12 ? 22 : 28;
  if (longestWord > 20) size = Math.min(size, 9);
  else if (longestWord > 15) size = Math.min(size, 12);
  else if (longestWord > 11) size = Math.min(size, 16);
  return size;
}

type A4Location = { rowName: string; position: string; columns: number; manualCode: string; qr: string };

function a4ShelfDocument(shelf: EstanteriaHerramientas, locations: A4Location[]) {
  const columns = locations.length > 18 ? 4 : 3;
  const rows = Math.max(1, Math.ceil(locations.length / columns));
  const cardHeight = Math.min(43, (252 - (rows - 1) * 2) / rows);
  const qrSize = Math.max(15, Math.min(27, cardHeight - 8));
  const cards = locations.map((location) => `<article class="card"><div class="info"><div class="place-name">${safe(location.rowName)}${location.columns > 1 ? ` · HUECO ${safe(location.position.slice(1))}` : ""}</div><div class="manual-code">${safe(location.manualCode)}</div></div><img class="location-qr" src="${location.qr}" alt="QR"></article>`).join("");
  return `<!doctype html><html><head><meta charset="utf-8"><title>${safe(shelf.codigo)} · Plano de ubicaciones</title><style>@page{size:A4 portrait;margin:8mm}*{box-sizing:border-box}html,body{margin:0;background:#fff;color:#000;font-family:Arial,sans-serif}body{width:194mm;min-height:281mm}.sheet-header{height:24mm;border:1mm solid #000;padding:3mm 4mm;display:flex;align-items:center;justify-content:space-between;gap:5mm}.eyebrow{font-size:8pt;font-weight:900;letter-spacing:1pt}.shelf-title{margin-top:1mm;font-size:23pt;line-height:1;font-weight:900}.zone{font-size:13pt;font-weight:900;text-align:right}.grid{height:252mm;margin-top:5mm;display:grid;grid-template-columns:repeat(${columns},minmax(0,1fr));grid-auto-rows:${cardHeight}mm;align-content:start;gap:2mm}.card{min-width:0;overflow:hidden;border:.45mm solid #000;border-radius:2mm;padding:1.8mm;display:grid;grid-template-columns:minmax(0,1fr) ${qrSize}mm;gap:1.5mm;align-items:center}.info{min-width:0}.place-name{font-size:${columns === 4 ? 9 : 11}pt;font-weight:900;line-height:1.02;overflow-wrap:break-word}.manual-code{margin-top:2mm;font:900 ${columns === 4 ? 7.5 : 9}pt/1 monospace;overflow-wrap:anywhere}.location-qr{display:block;width:${qrSize}mm;height:${qrSize}mm;image-rendering:pixelated}@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}</style></head><body><header class="sheet-header"><div><div class="eyebrow">PLANO DE UBICACIONES · CAZAPIEZAS</div><div class="shelf-title">${safe(shelf.codigo)} · ${safe(shelf.nombre)}</div></div><div class="zone">${safe(shelf.zona)}<br>${locations.length} huecos</div></header><main class="grid">${cards}</main><script>window.onload=()=>window.print()</script></body></html>`;
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
  if (size === "standard") {
    if (length > 90) return 5.8;
    if (length > 65) return 6.5;
    if (length > 48) return 7.4;
    if (length > 32) return 8.5;
    if (length > 20) return 10.5;
    return 14;
  }
  const multiplier = size === "large" ? 1.35 : 1;
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
