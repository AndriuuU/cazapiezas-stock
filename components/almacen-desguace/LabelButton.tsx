"use client";

import { useState } from "react";
import { Loader2, Maximize2, Minimize2, Printer, X } from "lucide-react";
import { buildPieceLabelHtml, buildPieceLabelPreviewHtml, type PieceLabelFormat } from "@/lib/piece-label";
import { openBrotherPrint } from "@/lib/print-bridge-client";
import type { PiezaDesguace } from "@/types/almacen-desguace";

const LABEL_FORMAT_KEY = "cazapiezas_piece_label_format";

export default function LabelButton({ pieza, variant = "default" }: { pieza: PiezaDesguace; variant?: "default" | "action" }) {
  const [busy, setBusy] = useState(false);
  const [choosing, setChoosing] = useState(false);
  const [lastFormat, setLastFormat] = useState<PieceLabelFormat>("normal");

  function openChooser() {
    const saved = window.localStorage.getItem(LABEL_FORMAT_KEY);
    if (saved === "normal" || saved === "compact") setLastFormat(saved);
    setChoosing(true);
  }

  function print(format: PieceLabelFormat) {
    setBusy(true);
    try {
      const popup = window.open("", "_blank", "width=700,height=520");
      if (!popup) throw new Error("El navegador ha bloqueado la ventana de impresión.");
      window.localStorage.setItem(LABEL_FORMAT_KEY, format);
      setLastFormat(format);
      setChoosing(false);
      popup.document.write(buildPieceLabelHtml(pieza, `${window.location.origin}/Logo2.png`, format));
      popup.document.close();
    } catch (caught) { window.alert(caught instanceof Error ? caught.message : "No se pudo imprimir."); }
    finally { setBusy(false); }
  }

  function printOnBrother(format: PieceLabelFormat) {
    setBusy(true);
    try {
      const html = buildPieceLabelHtml(pieza, `${window.location.origin}/Logo2.png`, format);
      openBrotherPrint(html);
      window.localStorage.setItem(LABEL_FORMAT_KEY, format);
      setLastFormat(format);
      setChoosing(false);
    } catch (caught) { window.alert(caught instanceof Error ? caught.message : "No se pudo contactar con el PC."); }
    finally { setBusy(false); }
  }

  return <>
    <button type="button" onClick={openChooser} disabled={busy} className={variant === "action" ? "flex w-full items-center gap-2 rounded-lg border border-zinc-700 px-3 py-2 text-left text-xs font-semibold text-zinc-300 hover:bg-zinc-800 hover:text-white disabled:opacity-50" : "inline-flex items-center gap-2 rounded-xl border border-zinc-700 px-4 py-2 font-semibold text-zinc-200 hover:bg-zinc-800 disabled:opacity-50"}>{busy ? <Loader2 size={17} className="animate-spin" /> : <Printer size={17} />} Imprimir etiqueta</button>
    {choosing && <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/80 p-3 backdrop-blur-sm sm:items-center sm:p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) setChoosing(false); }}>
      <div role="dialog" aria-modal="true" aria-labelledby="piece-label-format-title" className="w-full overflow-hidden rounded-3xl border border-zinc-700 bg-zinc-950 shadow-2xl" style={{ maxWidth: 680 }}>
        <header className="flex items-start justify-between gap-3 border-b border-zinc-800 p-5"><div><p className="font-mono text-xs font-bold text-amber-300">{pieza.referencia_principal || pieza.codigo_interno}</p><h2 id="piece-label-format-title" className="mt-1 text-xl font-black text-white">Elige el tamaño de la etiqueta</h2><p className="mt-1 text-sm text-zinc-500">Ambas incluyen Logo2 y código de barras, sin QR.</p></div><button type="button" onClick={() => setChoosing(false)} aria-label="Cerrar" className="rounded-xl border border-zinc-700 p-2 text-zinc-400 hover:bg-zinc-800 hover:text-white"><X size={20} /></button></header>
        <div className="grid gap-3 p-5 sm:grid-cols-2">
          <FormatButton pieza={pieza} format="normal" title="Normal" dimensions="62 × 42 mm" description="Incluye vehículo y marca." selected={lastFormat === "normal"} icon={<Maximize2 size={20} />} onBrowserPrint={() => print("normal")} onBrotherPrint={() => printOnBrother("normal")} />
          <FormatButton pieza={pieza} format="compact" title="Compacta" dimensions="62 × 30 mm" description="Para papel 62 × 32 mm." selected={lastFormat === "compact"} icon={<Minimize2 size={20} />} onBrowserPrint={() => print("compact")} onBrotherPrint={() => printOnBrother("compact")} />
        </div>
        <p className="border-t border-zinc-800 px-5 py-3 text-center text-xs text-zinc-600">Se recordará el último formato utilizado.</p>
      </div>
    </div>}
  </>;
}

function FormatButton({ pieza, format, title, dimensions, description, selected, icon, onBrowserPrint, onBrotherPrint }: { pieza: PiezaDesguace; format: PieceLabelFormat; title: string; dimensions: string; description: string; selected: boolean; icon: React.ReactNode; onBrowserPrint: () => void; onBrotherPrint: () => void }) {
  return <div className={`rounded-2xl border p-3 transition ${selected ? "border-amber-400 bg-amber-500/10" : "border-zinc-700 bg-zinc-900"}`}>
    <div className="mb-3 flex items-center justify-between gap-2"><span className={`flex items-center gap-2 font-black ${selected ? "text-amber-300" : "text-white"}`}>{icon}{title}</span>{selected && <span className="rounded-full bg-amber-400/15 px-2 py-1 text-[9px] font-black uppercase text-amber-300">Última usada</span>}</div>
    <PieceLabelPreview pieza={pieza} format={format} />
    <div className="mt-3"><span className="font-mono text-sm font-black text-cyan-300">{dimensions}</span><p className="mt-0.5 text-xs text-zinc-500">{description}</p><div className="mt-3 grid grid-cols-2 gap-2"><button type="button" onClick={onBrowserPrint} className="rounded-lg border border-zinc-600 px-2 py-2 text-xs font-black text-zinc-200 transition hover:bg-zinc-800">Navegador</button><button type="button" onClick={onBrotherPrint} className="rounded-lg px-2 py-2 text-xs font-black transition hover:brightness-110" style={{ backgroundColor: "#22d3ee", color: "#09090b" }}>Brother por Wi-Fi</button></div></div>
  </div>;
}

function PieceLabelPreview({ pieza, format }: { pieza: PiezaDesguace; format: PieceLabelFormat }) {
  const compact = format === "compact";
  return <div className="flex justify-center overflow-hidden rounded-lg bg-white p-1 shadow-lg shadow-black/40">
    <iframe
      title={`Vista previa de etiqueta ${compact ? "compacta" : "normal"}`}
      srcDoc={buildPieceLabelPreviewHtml(pieza, "/Logo2.png", format)}
      sandbox=""
      tabIndex={-1}
      className="pointer-events-none block border-0 bg-white"
      style={{ width: 234, maxWidth: "100%", height: compact ? 114 : 159 }}
    />
  </div>;
}
