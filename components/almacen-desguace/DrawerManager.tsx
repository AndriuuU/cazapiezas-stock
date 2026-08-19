"use client";

import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import { AlertTriangle, Archive, ArrowLeft, ArrowRight, Eye, Gauge, Loader2, MapPin, PackageOpen, PackagePlus, Plus, Search, X } from "lucide-react";
import ModuleHeader from "@/components/almacen-desguace/ModuleHeader";
import { useCurrentUser } from "@/components/auth/useCurrentUser";
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

function locationParts(location: string) {
  const match = location.match(/^DESGUACE-(E\d{2})-N(\d{2})-C(\d{2})$/);
  return match ? { shelf: match[1], level: Number(match[2]), slot: Number(match[3]) } : null;
}

export default function DrawerManager({ initialDrawers }: { initialDrawers: CajonDesguace[] }) {
  const currentUser = useCurrentUser();
  const isAdmin = currentUser?.rol === "administrador";
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
      <div className="flex flex-wrap items-center justify-between gap-3"><Link href="/almacen-desguace" className="inline-flex items-center gap-2 text-sm font-bold text-zinc-400 hover:text-white"><ArrowLeft size={17} /> Volver a las piezas</Link>{isAdmin && <button onClick={() => void openForm()} className="inline-flex items-center gap-2 rounded-xl bg-amber-500 px-4 py-2.5 font-black text-zinc-950 hover:bg-amber-400"><Plus size={18} /> Nuevo cajón</button>}</div>
      <section className="grid gap-2 sm:gap-3" style={{ gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }}><Summary icon={<Archive />} label="Cajones" value={drawers.length} tone="amber" /><Summary icon={<PackageOpen />} label="Piezas dentro" value={drawers.reduce((sum, drawer) => sum + drawer.cantidad_piezas, 0)} tone="cyan" /><Summary icon={<Gauge />} label="Cajones llenos" value={drawers.filter((drawer) => drawer.lleno).length} tone="red" /></section>
      <section className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-4"><div className="mb-3"><h2 className="font-black text-white">Localiza un cajón</h2><p className="text-sm text-zinc-500">Busca por código, contenido o ubicación física.</p></div><label className="relative block"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={18} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Ejemplo: CJ-001, sensores o E01..." className="w-full rounded-xl border border-zinc-700 bg-zinc-950 py-3 pl-10 pr-4 text-white outline-none focus:border-cyan-500" /></label></section>
      {error && <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">{error}</div>}
      {visible.length ? <div className="grid items-stretch gap-4 md:grid-cols-2 xl:grid-cols-3">{visible.map((drawer) => <DrawerCard key={drawer.id} admin={isAdmin} drawer={drawer} onToggleFull={() => void toggleFull(drawer)} />)}</div> : <div className="rounded-2xl border border-dashed border-zinc-700 py-16 text-center text-zinc-500"><Archive className="mx-auto mb-3" size={46} /><p className="font-bold">No hay cajones que mostrar.</p></div>}
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

function DrawerCard({ drawer, admin, onToggleFull }: { drawer: CajonDesguace; admin: boolean; onToggleFull: () => void }) {
  const location = locationParts(drawer.ubicacion);
  const full = drawer.lleno;
  const inactive = !drawer.activo;
  const status = inactive ? "INACTIVO" : full ? "LLENO" : "DISPONIBLE";
  const statusClass = inactive ? "border-zinc-600 bg-zinc-800 text-zinc-300" : full ? "border-red-500/30 bg-red-500/10 text-red-300" : "border-emerald-500/30 bg-emerald-500/10 text-emerald-300";
  const mapHref = location ? `/almacen-desguace/plano?estanteria=${location.shelf}&ubicacion=${encodeURIComponent(drawer.ubicacion)}#plano-fisico` : "/almacen-desguace/plano";

  return <article className="group flex h-full flex-col overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900 shadow-lg transition hover:-translate-y-0.5 hover:border-zinc-700 hover:shadow-cyan-950/20">
    <header className="flex items-start justify-between gap-3 border-b border-zinc-800 bg-zinc-950/35 p-5">
      <div className="flex min-w-0 items-start gap-3"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-amber-500/20 bg-amber-500/10 text-amber-300"><Archive size={22} /></span><div className="min-w-0"><p className="font-mono text-xs font-black tracking-wide text-amber-300">{drawer.codigo}</p><h2 className="truncate text-lg font-black text-white" title={drawer.nombre}>{drawer.nombre}</h2><p className="mt-0.5 line-clamp-2 text-xs text-zinc-500">{drawer.descripcion || "Sin descripción del contenido"}</p></div></div>
      <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-black ${statusClass}`}>{status}</span>
    </header>

    <div className="flex flex-1 flex-col gap-4 p-5">
      <Link href={mapHref} className="group/location flex items-center justify-between gap-3 rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-3 transition hover:border-cyan-400/50 hover:bg-cyan-500/10" title="Mostrar esta ubicación en el plano">
        <span className="flex min-w-0 items-center gap-3"><MapPin className="shrink-0 text-cyan-400" size={20} /><span className="min-w-0">{location ? <><span className="block text-sm font-black text-white">Estantería {location.shelf}</span><span className="block text-xs text-cyan-200">Nivel {location.level} · Hueco {location.slot}</span></> : <span className="block text-sm font-bold text-white">Ver ubicación</span>}<span className="block truncate font-mono text-[10px] text-zinc-600">{drawer.ubicacion}</span></span></span>
        <ArrowRight className="shrink-0 text-cyan-500 transition group-hover/location:translate-x-1" size={18} />
      </Link>

      <div>
        <div className="mb-2 flex items-end justify-between gap-3"><div><p className="text-xs text-zinc-500">Ocupación</p><p className="text-2xl font-black text-white">{drawer.cantidad_piezas}<span className="text-sm text-zinc-500"> / {drawer.capacidad_maxima}</span></p></div><p className={`text-sm font-black ${full ? "text-red-300" : "text-cyan-300"}`}>{drawer.porcentaje_ocupacion}%</p></div>
        <div className="h-2.5 overflow-hidden rounded-full bg-zinc-800"><div className={`h-full rounded-full transition-all ${full ? "bg-red-500" : "bg-cyan-500"}`} style={{ width: `${drawer.porcentaje_ocupacion}%` }} /></div>
        <p className="mt-2 text-xs text-zinc-500">{drawer.disponibles ? `${drawer.disponibles} espacios disponibles` : "Sin espacio disponible"}</p>
      </div>
    </div>

    <footer className="grid grid-cols-[1fr_auto] gap-2 border-t border-zinc-800 bg-zinc-950/35 p-4">
      <Link href={`/almacen-desguace/cajones/${drawer.id}`} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-cyan-500 px-4 py-2.5 text-sm font-black text-zinc-950 transition hover:bg-cyan-400"><Eye size={18} /> Ver cajón</Link>
      {admin && <button onClick={onToggleFull} className="min-h-11 rounded-xl border border-zinc-700 px-3 text-xs font-bold text-zinc-300 transition hover:border-amber-500/40 hover:text-amber-200">{drawer.lleno_manual ? "Liberar" : "Marcar lleno"}</button>}
    </footer>
  </article>;
}

function Summary({ icon, label, value, tone }: { icon: ReactNode; label: string; value: number; tone: "amber" | "cyan" | "red" }) {
  const colors = { amber: "border-amber-500/20 bg-amber-500/5 text-amber-300", cyan: "border-cyan-500/20 bg-cyan-500/5 text-cyan-300", red: "border-red-500/20 bg-red-500/5 text-red-300" };
  return <div className={`flex min-w-0 flex-col items-center justify-center gap-1 rounded-xl border px-2 py-2.5 text-center sm:flex-row sm:justify-start sm:gap-3 sm:rounded-2xl sm:p-4 sm:text-left ${colors[tone]}`}><span className="rounded-lg bg-black/20 p-1.5 [&>svg]:h-5 [&>svg]:w-5 sm:rounded-xl sm:p-2 sm:[&>svg]:h-6 sm:[&>svg]:w-6">{icon}</span><div className="min-w-0"><p className="text-[9px] font-bold uppercase leading-tight tracking-wide opacity-70 sm:text-xs">{label}</p><p className="mt-0.5 text-lg font-black leading-none text-white sm:text-2xl">{value}</p></div></div>;
}
function FormSection({ number, title, description, children }: { number: string; title: string; description: string; children: ReactNode }) { return <section><div className="mb-4 flex gap-3"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-500 font-black text-zinc-950">{number}</span><div><h3 className="font-black text-white">{title}</h3><p className="text-sm text-zinc-500">{description}</p></div></div><div className="sm:pl-11">{children}</div></section>; }
function FormField({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) { return <label className="block"><span className="mb-1.5 flex items-center justify-between gap-2 text-sm font-bold text-zinc-300"><span>{label}</span>{hint && <span className="text-xs font-normal text-zinc-600">{hint}</span>}</span>{children}</label>; }
