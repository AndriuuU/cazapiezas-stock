"use client";

import { useState, type RefObject } from "react";
import { Eraser, ListChecks, Loader2, MapPin, Sparkles } from "lucide-react";
import type { EstanteriaDesguace, SugerenciaUbicacion } from "@/types/almacen-desguace";

type SuggestionsResponse = {
  suggestion: SugerenciaUbicacion | null;
  alternatives: SugerenciaUbicacion[];
  availableShelves: EstanteriaDesguace[];
  error?: string;
};

function suffixFromLocation(value?: string | null) {
  return (value || "").trim().toUpperCase().replace(/^DESGUACE-/, "");
}

export default function LocationField({ initialValue, formRef }: { initialValue?: string | null; formRef: RefObject<HTMLFormElement | null> }) {
  const [suffix, setSuffix] = useState(() => suffixFromLocation(initialValue));
  const [data, setData] = useState<SuggestionsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [showChoices, setShowChoices] = useState(false);
  const [error, setError] = useState("");

  function choose(location: string) {
    setSuffix(suffixFromLocation(location));
    setShowChoices(false);
    setError("");
  }

  async function loadSuggestions(openChoices: boolean) {
    setLoading(true); setError("");
    try {
      const form = formRef.current ? new FormData(formRef.current) : new FormData();
      const response = await fetch("/api/almacen-desguace/ubicaciones/sugerir", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(Object.fromEntries(form.entries())),
      });
      const body = await response.json() as SuggestionsResponse;
      if (!response.ok) throw new Error(body.error || "No se pudieron consultar las estanterías.");
      setData(body);
      if (openChoices) setShowChoices(true);
      else if (body.suggestion) choose(body.suggestion.ubicacion);
      else { setShowChoices(true); setError("No hay una recomendación exacta. Puedes elegir cualquier hueco libre."); }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudieron consultar las estanterías.");
    } finally { setLoading(false); }
  }

  const fullLocation = suffix ? `DESGUACE-${suffix}` : "";
  return <div className="space-y-3 md:col-span-2 lg:col-span-4">
    <input type="hidden" name="ubicacion" value={fullLocation} />
    <div className="flex flex-wrap items-center justify-between gap-2"><div><p className="text-sm font-medium text-zinc-400">Ubicación exacta</p><p className="text-xs text-zinc-600">Puedes aceptar una recomendación, elegir un hueco, escribirlo o dejarlo vacío.</p></div><div className="flex flex-wrap gap-2"><button type="button" disabled={loading} onClick={() => void loadSuggestions(false)} className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs font-bold text-emerald-300 hover:bg-emerald-500/20 disabled:opacity-50">{loading ? <Loader2 className="animate-spin" size={15} /> : <Sparkles size={15} />} Usar recomendada</button><button type="button" disabled={loading} onClick={() => void loadSuggestions(true)} className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-3 py-2 text-xs font-bold text-cyan-300 hover:bg-cyan-500/20 disabled:opacity-50"><ListChecks size={15} /> Elegir hueco libre</button><button type="button" onClick={() => { setSuffix(""); setShowChoices(false); setError(""); }} className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-700 px-3 py-2 text-xs font-semibold text-zinc-400 hover:bg-zinc-800 hover:text-white"><Eraser size={15} /> Dejar en blanco</button></div></div>
    <div className="flex overflow-hidden rounded-xl border border-zinc-700 bg-zinc-950 focus-within:border-amber-500"><span className="flex items-center border-r border-zinc-700 bg-zinc-900 px-3 font-mono text-sm font-bold text-cyan-300"><MapPin size={16} className="mr-2" />DESGUACE-</span><input value={suffix} onChange={(event) => setSuffix(suffixFromLocation(event.target.value))} placeholder="E01-N03-C05" pattern="E[0-9]{2}-N[0-9]{2}-C[0-9]{2}" title="Formato: E01-N03-C05" className="min-w-0 flex-1 bg-transparent px-3 py-3 font-mono uppercase text-white outline-none placeholder:text-zinc-700" /></div>
    {!suffix && <p className="text-xs text-zinc-500">La pieza se guardará sin ubicación y podrás colocarla más adelante.</p>}
    {error && <p className="rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-200">{error}</p>}
    {showChoices && data && <div className="rounded-xl border border-zinc-700 bg-zinc-950 p-3"><div className="mb-2 flex items-center justify-between"><p className="text-sm font-bold text-white">Huecos disponibles</p><button type="button" onClick={() => setShowChoices(false)} className="text-xs text-zinc-500 hover:text-white">Ocultar</button></div>{data.suggestion && <button type="button" onClick={() => choose(data.suggestion!.ubicacion)} className="mb-2 flex w-full items-center justify-between rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-left"><span><span className="block text-xs font-bold uppercase text-emerald-400">Recomendada · {data.suggestion.estanteria.nombre}</span><span className="font-mono font-bold text-white">{data.suggestion.ubicacion}</span></span><span className="text-xs text-emerald-300">Usar</span></button>}<div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{data.availableShelves.map((shelf) => <button type="button" key={shelf.id} onClick={() => choose(shelf.siguiente_ubicacion!)} className="rounded-lg border border-zinc-800 p-3 text-left hover:border-cyan-500/50 hover:bg-zinc-900"><span className="block truncate text-xs text-zinc-500">{shelf.nombre} · {shelf.disponibles} libres</span><span className="font-mono text-sm font-bold text-cyan-300">{shelf.siguiente_ubicacion}</span></button>)}</div>{!data.availableShelves.length && <p className="py-4 text-center text-sm text-zinc-500">No hay estanterías con huecos libres.</p>}</div>}
  </div>;
}
