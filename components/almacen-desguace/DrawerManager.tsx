"use client";

import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import { AlertTriangle, Archive, ArrowLeft, Box, CheckCircle2, Loader2, MapPin, PackagePlus, Plus, Search, X } from "lucide-react";
import ModuleHeader from "@/components/almacen-desguace/ModuleHeader";
import type { CajonDesguace } from "@/types/almacen-desguace";

type FreeLocation = {
  ubicacion: string;
  zona: string;
  estanteria_codigo: string;
  estanteria_nombre: string;
  nivel: number;
  hueco: number;
};

const EMPTY_FORM = { nombre: "", descripcion: "", ubicacion: "", capacidad_maxima: "20" };
const inputClass = "w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-3 text-white outline-none transition placeholder:text-zinc-600 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/10";

export default function DrawerManager({ initialDrawers }: { initialDrawers: CajonDesguace[] }) {
  const [drawers, setDrawers] = useState(initialDrawers);
  const [query, setQuery] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadingLocations, setLoadingLocations] = useState(false);
  const [locations, setLocations] = useState<FreeLocation[]>([]);
  const [error, setError] = useState("");
  const [formError, setFormError] = useState("");
  const [form, setForm] = useState(EMPTY_FORM);
  const visible = useMemo(() => {
    const term = query.trim().toLowerCase();
    return term ? drawers.filter((drawer) => [drawer.codigo, drawer.nombre, drawer.descripcion, drawer.ubicacion].join(" ").toLowerCase().includes(term)) : drawers;
  }, [drawers, query]);
  const locationGroups = useMemo(() => Object.entries(Object.groupBy(locations, (location) => `${location.zona} · ${location.estanteria_codigo} · ${location.estanteria_nombre}`)), [locations]);
  const selectedLocation = locations.find((location) => location.ubicacion === form.ubicacion);

  async function reload() {
    const response = await fetch("/api/almacen-desguace/cajones");
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "No se pudieron actualizar los cajones.");
    setDrawers(data);
  }

  async function openForm() {
    setShowForm(true); setFormError(""); setForm(EMPTY_FORM); setLoadingLocations(true);
    try {
      const response = await fetch("/api/almacen-desguace/ubicaciones/disponibles");
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No se pudieron cargar los huecos libres.");
      setLocations(data);
      if (!data.length) setFormError("No queda ningún hueco libre. Libera uno o amplía una estantería antes de crear el cajón.");
    } catch (caught) { setFormError(caught instanceof Error ? caught.message : "No se pudieron cargar los huecos libres."); }
    finally { setLoadingLocations(false); }
  }

  async function create(event: FormEvent) {
    event.preventDefault(); setSaving(true); setFormError("");
    try {
      const response = await fetch("/api/almacen-desguace/cajones", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No se pudo crear el cajón.");
      await reload(); setShowForm(false); setForm(EMPTY_FORM);
    } catch (caught) { setFormError(caught instanceof Error ? caught.message : "No se pudo crear el cajón."); }
    finally { setSaving(false); }
  }

  async function toggleFull(drawer: CajonDesguace) {
    setError("");
    const response = await fetch(`/api/almacen-desguace/cajones/${drawer.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ lleno_manual: !drawer.lleno_manual }) });
    const data = await response.json();
    if (!response.ok) setError(data.error || "No se pudo cambiar el estado."); else await reload();
  }

  return <main className="min-h-screen bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950">
    <ModuleHeader title="Cajones del almacén" subtitle="Varias piezas pequeñas dentro de un único hueco" />
    <div className="mx-auto max-w-7xl space-y-5 px-4 py-6 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3"><Link href="/almacen-desguace" className="inline-flex items-center gap-2 text-sm font-bold text-zinc-400 hover:text-white"><ArrowLeft size={17} /> Volver a las piezas</Link><button onClick={() => void openForm()} className="inline-flex items-center gap-2 rounded-xl bg-amber-500 px-4 py-2.5 font-black text-zinc-950 hover:bg-amber-400"><Plus size={18} /> Nuevo cajón</button></div>
      <section className="grid gap-3 sm:grid-cols-3"><Summary label="Cajones" value={drawers.length} /><Summary label="Piezas dentro" value={drawers.reduce((sum, drawer) => sum + drawer.cantidad_piezas, 0)} /><Summary label="Cajones llenos" value={drawers.filter((drawer) => drawer.lleno).length} /></section>
      <label className="relative block"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={18} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar cajón por código, nombre o ubicación..." className="w-full rounded-xl border border-zinc-700 bg-zinc-950 py-3 pl-10 pr-4 text-white outline-none focus:border-cyan-500" /></label>
      {error && <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">{error}</div>}
      {visible.length ? <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{visible.map((drawer) => <article key={drawer.id} className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5"><div className="flex items-start justify-between gap-3"><div><p className="font-mono font-black text-amber-300">{drawer.codigo}</p><h2 className="text-xl font-black text-white">{drawer.nombre}</h2><p className="font-mono text-xs text-cyan-300">{drawer.ubicacion}</p></div>{drawer.lleno ? <span className="rounded-full bg-red-500/10 px-3 py-1 text-xs font-black text-red-300">LLENO</span> : <CheckCircle2 className="text-emerald-400" />}</div><div className="mt-4"><div className="mb-1 flex justify-between text-xs text-zinc-400"><span>{drawer.cantidad_piezas} piezas</span><span>{drawer.disponibles} libres</span></div><div className="h-2 overflow-hidden rounded-full bg-zinc-800"><div className={drawer.lleno ? "h-full bg-red-500" : "h-full bg-cyan-500"} style={{ width: `${drawer.porcentaje_ocupacion}%` }} /></div></div><div className="mt-5 flex gap-2"><Link href={`/almacen-desguace/cajones/${drawer.id}`} className="flex-1 rounded-xl bg-cyan-500 px-3 py-2.5 text-center text-sm font-black text-zinc-950"><Box className="mr-1 inline" size={16} /> Abrir cajón</Link><button onClick={() => void toggleFull(drawer)} className="rounded-xl border border-zinc-700 px-3 text-xs font-bold text-zinc-300">{drawer.lleno_manual ? "Liberar" : "Marcar lleno"}</button></div></article>)}</div> : <div className="rounded-2xl border border-dashed border-zinc-700 py-16 text-center text-zinc-500"><Archive className="mx-auto mb-3" size={46} /><p className="font-bold">No hay cajones que mostrar.</p></div>}
    </div>

    {showForm && <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/85 backdrop-blur-sm sm:items-center sm:p-4">
      <form onSubmit={create} className="flex max-h-[96dvh] w-full max-w-3xl flex-col overflow-hidden rounded-t-3xl border border-zinc-700 bg-zinc-900 shadow-2xl sm:rounded-3xl">
        <header className="flex shrink-0 items-start justify-between gap-4 border-b border-zinc-800 bg-zinc-900 px-5 py-4 sm:px-6"><div className="flex gap-3"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-500 text-zinc-950"><PackagePlus size={23} /></span><div><h2 className="text-xl font-black text-white">Crear un cajón</h2><p className="mt-0.5 text-sm text-zinc-400">Indica qué guardarás, elige un hueco libre y define su capacidad.</p></div></div><button type="button" onClick={() => setShowForm(false)} aria-label="Cerrar formulario" className="rounded-xl p-2 text-zinc-400 hover:bg-zinc-800 hover:text-white"><X /></button></header>
        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-5 py-5 sm:px-6">
          {formError && <div role="alert" className="flex gap-3 rounded-xl border border-red-400/40 bg-red-950/80 p-4 text-sm text-red-100 shadow-lg"><AlertTriangle className="shrink-0 text-red-400" size={20} /><div><p className="font-black">No se puede crear el cajón</p><p className="mt-1 leading-5">{formError}</p></div></div>}
          <FormSection number="1" title="Identifica el cajón" description="Pon un nombre que ayude a reconocer su contenido.">
            <div className="grid gap-4 sm:grid-cols-2"><FormField label="Nombre del cajón" hint="Por ejemplo: sensores pequeños"><input required autoFocus value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} placeholder="Sensores pequeños" className={inputClass} /></FormField><FormField label="Descripción" hint="Opcional"><input value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} placeholder="Modelos, marcas o indicaciones" className={inputClass} /></FormField></div>
          </FormSection>
          <FormSection number="2" title="Elige dónde estará" description="Solo aparecen huecos realmente libres del plano.">
            {loadingLocations ? <div className="flex items-center gap-2 rounded-xl border border-zinc-700 bg-zinc-950 p-4 text-zinc-400"><Loader2 className="animate-spin text-cyan-400" /> Buscando huecos libres...</div> : <FormField label="Hueco disponible"><select required value={form.ubicacion} onChange={(e) => setForm({ ...form, ubicacion: e.target.value })} className={inputClass}><option value="">Selecciona zona, estantería y hueco</option>{locationGroups.map(([group, options]) => <optgroup key={group} label={group}>{options?.map((location) => <option key={location.ubicacion} value={location.ubicacion}>Nivel {location.nivel} · Hueco {location.hueco}</option>)}</optgroup>)}</select></FormField>}
            {selectedLocation && <div className="mt-3 flex items-center gap-3 rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-4"><MapPin className="shrink-0 text-cyan-400" /><div><p className="font-bold text-white">{selectedLocation.zona} · {selectedLocation.estanteria_codigo}</p><p className="text-sm text-zinc-400">{selectedLocation.estanteria_nombre} · Nivel {selectedLocation.nivel} · Hueco {selectedLocation.hueco}</p><p className="mt-1 font-mono text-xs text-cyan-300">{selectedLocation.ubicacion}</p></div></div>}
          </FormSection>
          <FormSection number="3" title="Indica cuántas piezas caben" description="El sistema impedirá añadir más cuando alcance este límite.">
            <div className="grid gap-4 sm:grid-cols-[1fr_1.6fr]"><FormField label="Capacidad máxima"><input required type="number" min="1" max="9999" value={form.capacidad_maxima} onChange={(e) => setForm({ ...form, capacidad_maxima: e.target.value })} className={inputClass} /></FormField><div><p className="mb-2 text-sm text-zinc-400">Cantidades habituales</p><div className="grid grid-cols-4 gap-2">{[10, 20, 30, 50].map((capacity) => <button key={capacity} type="button" onClick={() => setForm({ ...form, capacidad_maxima: String(capacity) })} className={`rounded-xl border px-2 py-3 text-sm font-black ${form.capacidad_maxima === String(capacity) ? "border-amber-400 bg-amber-400/10 text-amber-300" : "border-zinc-700 bg-zinc-950 text-zinc-400 hover:border-zinc-500"}`}>{capacity}</button>)}</div></div></div>
          </FormSection>
        </div>
        <footer className="flex shrink-0 items-center justify-between gap-3 border-t border-zinc-800 bg-zinc-900 px-5 py-4 sm:px-6"><button type="button" onClick={() => setShowForm(false)} className="rounded-xl px-4 py-3 font-bold text-zinc-400 hover:bg-zinc-800 hover:text-white">Cancelar</button><button disabled={saving || loadingLocations || !locations.length} className="inline-flex min-w-44 items-center justify-center gap-2 rounded-xl bg-amber-500 px-5 py-3 font-black text-zinc-950 hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-40">{saving ? <Loader2 className="animate-spin" size={18} /> : <Plus size={18} />} Crear cajón</button></footer>
      </form>
    </div>}
  </main>;
}

function Summary({ label, value }: { label: string; value: number }) { return <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/5 p-4"><p className="text-xs uppercase text-cyan-300/70">{label}</p><p className="text-2xl font-black text-white">{value}</p></div>; }
function FormSection({ number, title, description, children }: { number: string; title: string; description: string; children: ReactNode }) { return <section><div className="mb-4 flex gap-3"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-500 font-black text-zinc-950">{number}</span><div><h3 className="font-black text-white">{title}</h3><p className="text-sm text-zinc-500">{description}</p></div></div><div className="sm:pl-11">{children}</div></section>; }
function FormField({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) { return <label className="block"><span className="mb-1.5 flex items-center justify-between gap-2 text-sm font-bold text-zinc-300"><span>{label}</span>{hint && <span className="text-xs font-normal text-zinc-600">{hint}</span>}</span>{children}</label>; }
