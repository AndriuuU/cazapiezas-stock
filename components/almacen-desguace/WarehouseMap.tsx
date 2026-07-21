"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Box, CheckCircle2, MapPinned, Search, Settings2, Warehouse, XCircle } from "lucide-react";
import ModuleHeader from "@/components/almacen-desguace/ModuleHeader";
import RealisticWarehousePlan from "@/components/almacen-desguace/RealisticWarehousePlan";
import type { ElementoPlanoAlmacen, EstanteriaPlanoAlmacen, HuecoPlanoAlmacen } from "@/types/almacen-desguace";

function normalize(value: string | null | undefined) {
  return (value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

export default function WarehouseMap({ shelves, initialLayout, focusedShelf, focusedLocation }: { shelves: EstanteriaPlanoAlmacen[]; initialLayout: ElementoPlanoAlmacen[]; focusedShelf?: string; focusedLocation?: string }) {
  const [query, setQuery] = useState("");
  const [zone, setZone] = useState("");
  const zones = useMemo(() => [...new Set(shelves.map((shelf) => shelf.zona || "Sin zona"))].sort((a, b) => a.localeCompare(b, "es")), [shelves]);
  const filtered = useMemo(() => {
    const term = normalize(query.trim());
    return shelves.filter((shelf) => {
      if (zone && shelf.zona !== zone) return false;
      if (!term) return true;
      const rules = shelf.reglas_nivel.flatMap((rule) => [rule.contenido, ...rule.categorias, ...rule.palabras_clave]);
      const pieces = shelf.huecos.flatMap((slot) => slot.pieza ? [slot.pieza.codigo_interno, slot.pieza.nombre_pieza, slot.pieza.categoria] : []);
      const drawers = shelf.huecos.flatMap((slot) => slot.cajon ? [slot.cajon.codigo, slot.cajon.nombre, slot.cajon.contenido_busqueda] : []);
      return normalize([shelf.codigo, shelf.nombre, shelf.descripcion, shelf.zona, ...rules, ...pieces, ...drawers].filter(Boolean).join(" ")).includes(term);
    });
  }, [query, shelves, zone]);
  const grouped = useMemo(() => Object.entries(Object.groupBy(filtered, (shelf) => shelf.zona || "Sin zona"))
    .sort(([left], [right]) => left.localeCompare(right, "es")), [filtered]);
  const visibleShelfCodes = useMemo(() => new Set(filtered.map((shelf) => shelf.codigo)), [filtered]);
  const occupied = shelves.reduce((total, shelf) => total + shelf.ocupados, 0);
  const capacity = shelves.reduce((total, shelf) => total + shelf.capacidad_maxima, 0);

  return <main className="min-h-screen bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950">
    <ModuleHeader title="Plano general del almacén" subtitle="Zonas, estanterías y huecos disponibles de un vistazo" />
    <div className="mx-auto max-w-[1600px] space-y-5 px-4 py-6 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3"><Link href="/almacen-desguace" className="inline-flex items-center gap-2 text-sm font-semibold text-zinc-400 hover:text-white"><ArrowLeft size={17} /> Volver a las piezas</Link><div className="flex flex-wrap gap-2"><Link href="/almacen-desguace/cajones" className="inline-flex items-center gap-2 rounded-xl border border-cyan-500/30 bg-cyan-500/5 px-4 py-2.5 font-bold text-cyan-200"><Box size={17} /> Gestionar cajones</Link><Link href="/almacen-desguace/estanterias" className="inline-flex items-center gap-2 rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-2.5 font-bold text-zinc-200 hover:border-amber-500/40 hover:text-amber-300"><Settings2 size={17} /> Configurar estanterías</Link></div></div>

      <section className="grid gap-3 sm:grid-cols-3">
        <Summary icon={<MapPinned />} label="Zonas" value={zones.length} tone="cyan" />
        <Summary icon={<Warehouse />} label="Estanterías" value={shelves.length} tone="amber" />
        <Summary icon={<Box />} label="Ocupación total" value={`${occupied} / ${capacity}`} tone="emerald" />
      </section>

      <section className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-4">
        <div className="grid gap-3 lg:grid-cols-[1fr_260px]">
          <label className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={18} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por nombre, tipo de pieza, zona o referencia..." className="w-full rounded-xl border border-zinc-700 bg-zinc-950 py-3 pl-10 pr-4 text-white outline-none focus:border-cyan-500" /></label>
          <select value={zone} onChange={(event) => setZone(event.target.value)} className="rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-3 text-white outline-none focus:border-cyan-500"><option value="">Todas las zonas</option>{zones.map((item) => <option key={item}>{item}</option>)}</select>
        </div>
        <div className="mt-4 flex flex-wrap gap-4 text-xs text-zinc-400"><Legend color="#22c55e" text="Hueco libre" /><Legend color="#fbbf24" text="Pieza directa" /><Legend color="#22d3ee" text="Cajón" /><Legend color="#3f3f46" text="No disponible" /><Legend color="#ef4444" text="Estantería llena o inactiva" /></div>
      </section>

      <RealisticWarehousePlan shelves={shelves} initialLayout={initialLayout} visibleShelfCodes={visibleShelfCodes} searching={Boolean(query.trim() || zone)} focusedShelf={focusedShelf} focusedLocation={focusedLocation} />

      {grouped.length === 0 ? <div className="rounded-2xl border border-dashed border-zinc-700 py-16 text-center"><Search className="mx-auto mb-3 text-zinc-700" size={44} /><p className="font-bold text-zinc-300">No hay estanterías que coincidan.</p><p className="mt-1 text-sm text-zinc-500">Prueba con otro nombre, pieza o zona.</p></div> : grouped.map(([zoneName, zoneShelves]) => <section key={zoneName} className="space-y-3">
        <div className="flex items-center gap-3"><span className="rounded-xl bg-cyan-500/10 p-2 text-cyan-300"><MapPinned size={20} /></span><div><h2 className="text-xl font-black text-white">{zoneName}</h2><p className="text-xs text-zinc-500">{zoneShelves?.length || 0} estanterías en esta zona</p></div></div>
        <div className="grid items-start gap-4 xl:grid-cols-2">{zoneShelves?.map((shelf) => <ShelfMapCard key={shelf.id} shelf={shelf} />)}</div>
      </section>)}
    </div>
  </main>;
}

function ShelfMapCard({ shelf }: { shelf: EstanteriaPlanoAlmacen }) {
  const byLevel = Object.groupBy(shelf.huecos, (slot) => slot.nivel);
  const status = !shelf.activa ? "Inactiva" : shelf.llena ? "Llena" : "Disponible";
  return <article id={`estanteria-${shelf.codigo}`} className={`scroll-mt-5 overflow-hidden rounded-2xl border bg-zinc-900 ${shelf.llena || !shelf.activa ? "border-red-500/30" : "border-zinc-800"}`}>
    <header className="flex flex-wrap items-start justify-between gap-3 border-b border-zinc-800 p-4"><div><div className="flex items-center gap-2"><span className="font-mono text-sm font-black text-amber-300">{shelf.codigo}</span><span className="text-xs text-zinc-500">orden {shelf.orden_plano}</span></div><h3 className="text-lg font-bold text-white">{shelf.nombre}</h3><p className="mt-1 text-sm text-zinc-500">{shelf.descripcion || "Sin indicaciones adicionales"}</p></div><span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold ${status === "Disponible" ? "bg-emerald-500/10 text-emerald-300" : "bg-red-500/10 text-red-300"}`}>{status === "Disponible" ? <CheckCircle2 size={14} /> : <XCircle size={14} />}{status}</span></header>
    <div className="space-y-3 p-4">{Object.entries(byLevel).map(([level, slots]) => <div key={level} className="grid grid-cols-[72px_1fr] items-start gap-3"><div className="pt-2"><p className="text-xs font-bold uppercase tracking-wide text-cyan-300">Nivel {level}</p><p className="text-[11px] text-zinc-600">{slots?.filter((slot) => slot.pieza || slot.cajon).length || 0}/{slots?.length || 0}</p></div><div className="overflow-x-auto pb-1"><div className="grid min-w-max gap-2" style={{ gridTemplateColumns: `repeat(${slots?.length || 1}, 42px)` }}>{slots?.map((slot) => <Slot key={slot.ubicacion} slot={slot} />)}</div></div></div>)}</div>
    <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-zinc-800 bg-zinc-950/40 px-4 py-3 text-xs"><span className="text-zinc-400"><strong className="text-white">{shelf.ocupados}</strong> ocupados · <strong className="text-emerald-300">{shelf.disponibles}</strong> libres</span><span className="text-zinc-500">{shelf.porcentaje_ocupacion}% ocupado</span></footer>
  </article>;
}

function Slot({ slot }: { slot: HuecoPlanoAlmacen }) {
  const label = `H${String(slot.hueco).padStart(2, "0")}`;
  if (slot.cajon) return <Link href={`/almacen-desguace/cajones/${slot.cajon.id}`} title={`${slot.ubicacion}\n${slot.cajon.codigo} · ${slot.cajon.cantidad_piezas}/${slot.cajon.capacidad_maxima} piezas`} aria-label={`${slot.ubicacion}, ocupada por el cajón ${slot.cajon.codigo}`} className="flex h-11 items-center justify-center rounded-lg border border-cyan-400/50 bg-cyan-400/15 text-[11px] font-black text-cyan-200 transition hover:scale-105 hover:bg-cyan-400/25">{label}</Link>;
  if (slot.pieza) return <Link href={`/almacen-desguace/${slot.pieza.id}`} title={`${slot.ubicacion}\n${slot.pieza.nombre_pieza || slot.pieza.codigo_interno}`} aria-label={`${slot.ubicacion}, ocupada por ${slot.pieza.nombre_pieza || slot.pieza.codigo_interno}`} className="flex h-11 items-center justify-center rounded-lg border border-amber-400/40 bg-amber-400/15 text-[11px] font-black text-amber-200 transition hover:scale-105 hover:bg-amber-400/25">{label}</Link>;
  if (slot.disponible) return <span title={`${slot.ubicacion} · libre`} className="flex h-11 items-center justify-center rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-[11px] font-bold text-emerald-300">{label}</span>;
  return <span title={`${slot.ubicacion} · no disponible`} className="flex h-11 items-center justify-center rounded-lg border border-zinc-700 bg-zinc-800 text-[11px] text-zinc-600">{label}</span>;
}

function Summary({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: React.ReactNode; tone: "cyan" | "amber" | "emerald" }) {
  const colors = { cyan: "border-cyan-500/20 bg-cyan-500/5 text-cyan-300", amber: "border-amber-500/20 bg-amber-500/5 text-amber-300", emerald: "border-emerald-500/20 bg-emerald-500/5 text-emerald-300" };
  return <div className={`flex items-center gap-3 rounded-2xl border p-4 ${colors[tone]}`}><span>{icon}</span><div><p className="text-xs uppercase tracking-wide opacity-70">{label}</p><p className="text-2xl font-black text-white">{value}</p></div></div>;
}

function Legend({ color, text }: { color: string; text: string }) { return <span className="inline-flex items-center gap-2"><span className="inline-block flex-none rounded" style={{ width: 12, height: 12, backgroundColor: color }} />{text}</span>; }
