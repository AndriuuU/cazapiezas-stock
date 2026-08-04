"use client";

import { useCallback, useEffect, useState, type RefObject } from "react";
import { Archive, Eraser, ListChecks, Loader2, MapPin, Sparkles, Warehouse } from "lucide-react";
import AvailableLocationPicker, { type FreeWarehouseLocation } from "@/components/almacen-desguace/AvailableLocationPicker";
import type { CajonDesguace, PiezaDesguace, SugerenciaUbicacion } from "@/types/almacen-desguace";

type SuggestionsResponse = {
  suggestion: SugerenciaUbicacion | null;
  error?: string;
};
type LocationMode = "shelf" | "drawer" | "pending";
type InitialDrawer = PiezaDesguace["cajon"];

function suffixFromLocation(value?: string | null) {
  return (value || "").trim().toUpperCase().replace(/^DESGUACE-/, "");
}

export default function LocationField({ initialValue, initialDrawerId, initialDrawer, formRef }: { initialValue?: string | null; initialDrawerId?: number | null; initialDrawer?: InitialDrawer; formRef: RefObject<HTMLFormElement | null> }) {
  const [mode, setMode] = useState<LocationMode>(() => initialDrawerId ? "drawer" : initialValue ? "shelf" : "pending");
  const [suffix, setSuffix] = useState(() => initialDrawerId ? "" : suffixFromLocation(initialValue));
  const [selectedDrawerId, setSelectedDrawerId] = useState(() => initialDrawerId ? String(initialDrawerId) : "");
  const [drawers, setDrawers] = useState<CajonDesguace[]>([]);
  const [drawersLoaded, setDrawersLoaded] = useState(false);
  const [drawerLoading, setDrawerLoading] = useState(false);
  const [availableLocations, setAvailableLocations] = useState<FreeWarehouseLocation[]>([]);
  const [loading, setLoading] = useState(false);
  const [showChoices, setShowChoices] = useState(false);
  const [error, setError] = useState("");

  const loadDrawers = useCallback(async () => {
    setDrawerLoading(true); setError("");
    try {
      const response = await fetch("/api/almacen-desguace/cajones", { cache: "no-store" });
      const body = await response.json() as CajonDesguace[] & { error?: string };
      if (!response.ok) throw new Error(body.error || "No se pudieron cargar los cajones.");
      setDrawers(body.filter((drawer) => drawer.activo && ((!drawer.lleno && drawer.disponibles > 0) || drawer.id === initialDrawerId)));
      setDrawersLoaded(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudieron cargar los cajones.");
    } finally { setDrawerLoading(false); }
  }, [initialDrawerId]);

  useEffect(() => {
    if (mode !== "drawer" || drawersLoaded || drawerLoading) return;
    const timer = window.setTimeout(() => void loadDrawers(), 0);
    return () => window.clearTimeout(timer);
  }, [drawerLoading, drawersLoaded, loadDrawers, mode]);

  function choose(location: string) {
    setSuffix(suffixFromLocation(location));
    setShowChoices(false);
    setError("");
  }

  function chooseMode(next: LocationMode) {
    setMode(next);
    setError("");
    setShowChoices(false);
    if (next === "drawer") setSuffix("");
    if (next === "shelf") setSelectedDrawerId("");
    if (next === "pending") { setSuffix(""); setSelectedDrawerId(""); }
  }

  async function chooseSuggestedLocation() {
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
      if (body.suggestion) choose(body.suggestion.ubicacion);
      else setError("No hay una recomendación exacta. Pulsa “Elegir nivel y hueco” para escoger una posición libre.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudieron consultar las estanterías.");
    } finally { setLoading(false); }
  }

  async function loadAvailableLocations() {
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/almacen-desguace/ubicaciones/disponibles", { cache: "no-store" });
      const body = await response.json() as FreeWarehouseLocation[] & { error?: string };
      if (!response.ok) throw new Error(body.error || "No se pudieron cargar los huecos disponibles.");
      setAvailableLocations(body);
      setShowChoices(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudieron cargar los huecos disponibles.");
    } finally { setLoading(false); }
  }

  const fullLocation = suffix ? `DESGUACE-${suffix}` : "";
  const initialDrawerMissing = initialDrawerId && !drawers.some((drawer) => drawer.id === initialDrawerId);
  return <div className="min-w-0 max-w-full space-y-4 md:col-span-2 lg:col-span-4">
    <div><p className="text-sm font-medium text-zinc-300">¿Dónde se guardará la pieza?</p><p className="text-xs text-zinc-600">Las piezas grandes van directamente a una estantería; las pequeñas pueden ir dentro de un cajón.</p></div>
    <div className="grid gap-2 sm:grid-cols-3">
      <ModeButton active={mode === "shelf"} onClick={() => chooseMode("shelf")} icon={<Warehouse size={19} />} title="Estantería" description="Ocupa un hueco completo" />
      <ModeButton active={mode === "drawer"} onClick={() => chooseMode("drawer")} icon={<Archive size={19} />} title="Cajón" description="Comparte el hueco del cajón" />
      <ModeButton active={mode === "pending"} onClick={() => chooseMode("pending")} icon={<Eraser size={19} />} title="Pendiente" description="Ubicarla más adelante" />
    </div>

    {mode === "shelf" && <section className="min-w-0 max-w-full space-y-3 overflow-hidden rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4">
      <input type="hidden" name="ubicacion" value={fullLocation} /><input type="hidden" name="cajon_id" value="" />
      <div className="flex flex-wrap items-center justify-between gap-2"><div><p className="font-bold text-emerald-200">Hueco exacto de estantería</p><p className="text-xs text-zinc-500">Elige la estantería, el nivel y el hueco concretos.</p></div><div className="flex flex-wrap gap-2"><button type="button" disabled={loading} onClick={() => void chooseSuggestedLocation()} className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs font-bold text-emerald-300 disabled:opacity-50">{loading ? <Loader2 className="animate-spin" size={15} /> : <Sparkles size={15} />} Usar recomendada</button><button type="button" disabled={loading} onClick={() => void loadAvailableLocations()} className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-3 py-2 text-xs font-bold text-cyan-300 disabled:opacity-50"><ListChecks size={15} /> Elegir nivel y hueco</button></div></div>
      <div className={`flex min-w-0 items-center gap-3 rounded-xl border p-3 ${fullLocation ? "border-amber-500/30 bg-amber-500/10" : "border-zinc-700 bg-zinc-950"}`}><MapPin className={fullLocation ? "shrink-0 text-amber-300" : "shrink-0 text-zinc-600"} size={20} /><div className="min-w-0"><p className="text-xs font-bold text-zinc-500">Ubicación elegida</p>{fullLocation ? <><p className="break-all font-mono text-sm font-black text-white">{fullLocation}</p><p className="mt-0.5 text-xs text-amber-200">{describeLocation(fullLocation)}</p></> : <p className="text-sm text-zinc-500">Todavía no has elegido ningún hueco.</p>}</div></div>
      {showChoices && <div className="rounded-xl border border-zinc-700 bg-zinc-950 p-3"><div className="mb-3 flex items-center justify-between"><div><p className="text-sm font-bold text-white">Selecciona el hueco exacto</p><p className="text-xs text-zinc-500">Solo aparecen posiciones libres.</p></div><button type="button" onClick={() => setShowChoices(false)} className="rounded-lg px-2 py-1 text-xs text-zinc-500 hover:bg-zinc-800 hover:text-white">Ocultar</button></div><AvailableLocationPicker locations={availableLocations} value={fullLocation} onChange={choose} /></div>}
    </section>}

    {mode === "drawer" && <section className="min-w-0 max-w-full space-y-3 overflow-hidden rounded-2xl border border-cyan-500/20 bg-cyan-500/5 p-4">
      <input type="hidden" name="ubicacion" value="" />
      <div><p className="font-bold text-cyan-200">Elegir el cajón exacto</p><p className="text-xs text-zinc-500">Se muestra su código, nombre, espacio libre y ubicación física.</p></div>
      {drawerLoading ? <div className="flex items-center gap-2 rounded-xl border border-zinc-700 bg-zinc-950 p-4 text-zinc-400"><Loader2 className="animate-spin text-cyan-400" size={18} /> Cargando cajones...</div> : <select name="cajon_id" required value={selectedDrawerId} onChange={(event) => setSelectedDrawerId(event.target.value)} className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-3 text-white outline-none focus:border-cyan-500"><option value="">Selecciona un cajón disponible</option>{initialDrawerMissing && <option value={String(initialDrawerId)}>{initialDrawer?.codigo || `Cajón ${initialDrawerId}`} · cajón actual</option>}{drawers.map((drawer) => <option key={drawer.id} value={drawer.id}>{drawer.codigo} · {drawer.nombre} · {drawer.disponibles} espacios libres · {drawer.ubicacion}</option>)}</select>}
      {!drawerLoading && drawersLoaded && !drawers.length && !initialDrawerMissing && <p className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-sm text-amber-200">No hay cajones con espacio disponible.</p>}
    </section>}

    {mode === "pending" && <section className="rounded-2xl border border-zinc-700 bg-zinc-950 p-4"><input type="hidden" name="ubicacion" value="" /><input type="hidden" name="cajon_id" value="" /><p className="font-bold text-zinc-300">Pendiente de ubicar</p><p className="mt-1 text-sm text-zinc-500">La pieza se guardará sin estantería ni cajón. Podrás asignarla después desde la lista.</p></section>}
    {error && <p role="alert" className="rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-200">{error}</p>}
  </div>;
}

function ModeButton({ active, onClick, icon, title, description }: { active: boolean; onClick: () => void; icon: React.ReactNode; title: string; description: string }) {
  return <button type="button" onClick={onClick} className={`flex min-h-20 items-center gap-3 rounded-xl border p-3 text-left transition ${active ? "border-amber-400 bg-amber-500/10 text-white" : "border-zinc-700 bg-zinc-950 text-zinc-400 hover:border-zinc-500"}`}><span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${active ? "bg-amber-400 text-zinc-950" : "bg-zinc-800"}`}>{icon}</span><span><strong className="block text-sm">{title}</strong><span className="text-xs text-zinc-500">{description}</span></span></button>;
}

function describeLocation(location: string) {
  const match = location.match(/-E(\d+)-N(\d+)-C(\d+)$/i);
  if (!match) return location;
  return `Estantería E${match[1]} · Nivel ${Number(match[2])} · Hueco ${Number(match[3])}`;
}
