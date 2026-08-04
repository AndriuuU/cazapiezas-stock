"use client";

import { useState } from "react";
import { Loader2, Printer } from "lucide-react";
import { buildPieceLabelHtml } from "@/lib/piece-label";
import type { PiezaDesguace } from "@/types/almacen-desguace";

export default function LabelButton({ pieza }: { pieza: PiezaDesguace }) {
  const [busy, setBusy] = useState(false);
  async function print() {
    setBusy(true);
    try {
      const popup = window.open("", "_blank", "width=700,height=520");
      if (!popup) throw new Error("El navegador ha bloqueado la ventana de impresión.");
      popup.document.write(buildPieceLabelHtml(pieza, `${window.location.origin}/Logo2.png`));
      popup.document.close();
    } catch (caught) { window.alert(caught instanceof Error ? caught.message : "No se pudo imprimir."); }
    finally { setBusy(false); }
  }
  return <button onClick={() => void print()} disabled={busy} className="inline-flex items-center gap-2 rounded-xl border border-zinc-700 px-4 py-2 font-semibold text-zinc-200 hover:bg-zinc-800 disabled:opacity-50">{busy ? <Loader2 size={17} className="animate-spin" /> : <Printer size={17} />} Etiqueta con código de barras</button>;
}
