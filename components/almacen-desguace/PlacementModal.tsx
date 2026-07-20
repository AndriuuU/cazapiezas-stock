"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, Loader2, MapPin, RefreshCw, X } from "lucide-react";
import type { EstanteriaDesguace, PiezaDesguace, SugerenciaUbicacion } from "@/types/almacen-desguace";

type SuggestionResponse = {
  piece: PiezaDesguace;
  suggestion: SugerenciaUbicacion | null;
  alternatives: SugerenciaUbicacion[];
  shelves: EstanteriaDesguace[];
};
type Mode = "suggestion" | "alternative" | "failed";

export default function PlacementModal({ piece, onClose, onPlaced }: { piece: PiezaDesguace; onClose: () => void; onPlaced: (message: string) => void }) {
  const [data, setData] = useState<SuggestionResponse | null>(null);
  const [mode, setMode] = useState<Mode>("suggestion");
  const [alternative, setAlternative] = useState("");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError(""); setMode("suggestion");
    try {
      const response = await fetch(`/api/almacen-desguace/${piece.id}/ubicar`);
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "No se pudo obtener una sugerencia.");
      setData(body);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "No se pudo obtener una sugerencia."); }
    finally { setLoading(false); }
  }, [piece.id]);
  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function confirm(result: "colocada_sugerida" | "colocada_alternativa" | "no_colocada") {
    setSaving(true); setError("");
    try {
      const response = await fetch(`/api/almacen-desguace/${piece.id}/ubicar`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resultado: result,
          ubicacion_sugerida: data?.suggestion?.ubicacion || null,
          ubicacion_final: result === "colocada_alternativa" ? alternative : null,
          motivo: reason,
        }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "No se pudo confirmar la colocación.");
      const message = result === "colocada_sugerida"
        ? `Pieza colocada en ${body.piece.ubicacion}.`
        : result === "colocada_alternativa" ? `Ubicación alternativa guardada: ${body.piece.ubicacion}.` : "Incidencia de colocación registrada.";
      onPlaced(message);
      onClose();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "No se pudo confirmar la colocación."); }
    finally { setSaving(false); }
  }

  return <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 p-4 backdrop-blur-sm md:items-center"><div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-zinc-700 bg-zinc-900 shadow-2xl"><div className="sticky top-0 z-10 flex items-center justify-between border-b border-zinc-800 bg-zinc-900 p-4"><div><p className="font-mono text-xs font-bold text-amber-300">{piece.codigo_interno}</p><h2 className="text-xl font-bold text-white">Colocar {piece.nombre_pieza || "pieza"}</h2></div><button onClick={onClose} className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-800"><X /></button></div><div className="space-y-4 p-5">
    {loading ? <div className="flex justify-center gap-2 py-12 text-zinc-400"><Loader2 className="animate-spin" /> Buscando el mejor hueco...</div> : <>
      {error && <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">{error}</div>}
      {data?.suggestion ? <section className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-5"><p className="text-xs font-bold uppercase tracking-wide text-emerald-300">Ubicación recomendada</p><div className="mt-2 flex items-start gap-3"><MapPin className="mt-1 text-emerald-400" /><div><p className="font-mono text-2xl font-black text-white">{data.suggestion.ubicacion}</p><p className="font-semibold text-emerald-100">{data.suggestion.estanteria.nombre}</p><div className="mt-2 flex flex-wrap gap-1">{data.suggestion.motivos.map((item) => <span key={item} className="rounded bg-black/20 px-2 py-1 text-xs text-emerald-200">{item}</span>)}</div><p className="mt-3 text-xs text-emerald-200/70">Quedan {data.suggestion.estanteria.disponibles} huecos antes de colocar esta pieza.</p></div></div></section> : <section className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-5"><div className="flex gap-3"><AlertTriangle className="shrink-0 text-amber-400" /><div><p className="font-bold text-amber-200">No hay una estantería adecuada disponible</p><p className="mt-1 text-sm text-amber-200/70">Configura reglas que coincidan con esta pieza o indica manualmente dónde la has colocado.</p><Link href="/almacen-desguace/estanterias" className="mt-3 inline-block text-sm font-bold text-amber-300 underline">Gestionar estanterías</Link></div></div></section>}

      {mode === "suggestion" && <div className="grid gap-2 sm:grid-cols-3">{data?.suggestion && <button disabled={saving} onClick={() => void confirm("colocada_sugerida")} className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-3 font-bold text-zinc-950"><CheckCircle2 size={18} /> Sí, colocada ahí</button>}<button onClick={() => setMode("alternative")} className="rounded-xl border border-amber-500/30 px-4 py-3 font-semibold text-amber-300">No, está en otro sitio</button><button onClick={() => setMode("failed")} className="rounded-xl border border-red-500/30 px-4 py-3 font-semibold text-red-300">No pude colocarla</button></div>}

      {mode === "alternative" && <section className="space-y-3 rounded-2xl border border-amber-500/30 bg-zinc-950 p-4"><div><h3 className="font-bold text-white">¿Dónde la has colocado?</h3><p className="text-sm text-zinc-500">Debe ser una estantería configurada y con espacio.</p></div>{data?.alternatives.length ? <div className="flex flex-wrap gap-2">{data.alternatives.map((item) => <button key={item.ubicacion} onClick={() => setAlternative(item.ubicacion)} className="rounded-lg border border-zinc-700 px-3 py-2 text-left text-sm text-zinc-300 hover:border-amber-500"><span className="block font-mono font-bold text-amber-300">{item.ubicacion}</span>{item.estanteria.nombre}</button>)}</div> : null}<input value={alternative} onChange={(event) => setAlternative(event.target.value.toUpperCase())} placeholder="DESGUACE-E02-N01-C03" className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-3 font-mono text-white focus:border-amber-500 focus:outline-none" /><textarea value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Motivo opcional: no cabía, acceso bloqueado..." rows={2} className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-3 text-white focus:border-amber-500 focus:outline-none" /><div className="flex justify-end gap-2"><button onClick={() => setMode("suggestion")} className="px-3 py-2 text-zinc-400">Volver</button><button disabled={saving || !alternative} onClick={() => void confirm("colocada_alternativa")} className="inline-flex items-center gap-2 rounded-xl bg-amber-500 px-4 py-2.5 font-bold text-zinc-950 disabled:opacity-50">{saving && <Loader2 size={16} className="animate-spin" />} Guardar ubicación real</button></div></section>}

      {mode === "failed" && <section className="space-y-3 rounded-2xl border border-red-500/30 bg-zinc-950 p-4"><h3 className="font-bold text-white">Registrar que no se ha podido colocar</h3><textarea value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Indica el motivo: estanterías llenas, pieza demasiado grande..." rows={3} className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-3 text-white focus:border-red-500 focus:outline-none" /><div className="flex justify-end gap-2"><button onClick={() => setMode("suggestion")} className="px-3 py-2 text-zinc-400">Volver</button><button disabled={saving || !reason.trim()} onClick={() => void confirm("no_colocada")} className="inline-flex items-center gap-2 rounded-xl bg-red-500 px-4 py-2.5 font-bold text-white disabled:opacity-50">{saving && <Loader2 size={16} className="animate-spin" />} Registrar incidencia</button></div></section>}

      <div className="flex items-center justify-between border-t border-zinc-800 pt-3 text-xs text-zinc-500"><span>Ubicación actual: {piece.ubicacion || "sin ubicación"}</span><button onClick={() => void load()} className="inline-flex items-center gap-1 hover:text-white"><RefreshCw size={13} /> Recalcular</button></div>
    </>}
  </div></div></div>;
}
