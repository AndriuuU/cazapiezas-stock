import Link from "next/link";
import { notFound } from "next/navigation";
import { Archive, ArrowLeft, Box, CheckCircle2, Layers3, MapPin, PackageOpen, Warehouse, XCircle } from "lucide-react";
import ModuleHeader from "@/components/almacen-desguace/ModuleHeader";
import ShelfLabelButton from "@/components/almacen-desguace/ShelfLabelButton";
import { getWarehousePlan } from "@/lib/almacen-desguace-estanterias";
import type { EstanteriaPlanoAlmacen, HuecoPlanoAlmacen } from "@/types/almacen-desguace";

export const dynamic = "force-dynamic";

export default async function ShelfDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const shelves = await getWarehousePlan();
  const shelf = shelves.find((item) => item.id === Number(id));
  if (!shelf) notFound();

  const directPieces = shelf.huecos.filter((slot) => slot.pieza).length;
  const drawers = shelf.huecos.filter((slot) => slot.cajon);
  const piecesInDrawers = drawers.reduce((total, slot) => total + (slot.cajon?.cantidad_piezas || 0), 0);
  const byLevel = Object.entries(Object.groupBy(shelf.huecos, (slot) => slot.nivel)).sort(([left], [right]) => Number(right) - Number(left));
  const status = !shelf.activa ? "Inactiva" : shelf.llena ? "Llena" : "Disponible";

  return <main className="min-h-screen bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950">
    <ModuleHeader title={`${shelf.codigo} · ${shelf.nombre}`} subtitle="Ocupación y contenido actualizado de la estantería" />
    <div className="mx-auto max-w-7xl space-y-5 px-4 py-6 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3"><Link href="/almacen-desguace/estanterias" className="inline-flex items-center gap-2 text-sm font-bold text-zinc-400 hover:text-white"><ArrowLeft size={17} /> Volver a estanterías</Link><div className="flex flex-wrap gap-2"><Link href={`/almacen-desguace/plano?estanteria=${shelf.codigo}#plano-fisico`} className="inline-flex items-center gap-2 rounded-xl border border-zinc-700 px-4 py-2.5 font-bold text-zinc-200 hover:border-amber-500/40 hover:text-amber-300"><MapPin size={17} /> Ver en el plano</Link><ShelfLabelButton shelf={shelf} /></div></div>

      <section className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900">
        <div className="flex flex-wrap items-start justify-between gap-4 p-5 sm:p-6"><div><div className="flex flex-wrap items-center gap-2"><p className="font-mono text-xl font-black text-amber-300">{shelf.codigo}</p><span className="rounded-full bg-cyan-500/10 px-2.5 py-1 text-xs font-bold text-cyan-300">{shelf.zona || "Sin zona"}</span></div><h1 className="mt-1 text-3xl font-black text-white">{shelf.nombre}</h1><p className="mt-2 max-w-3xl text-zinc-500">{shelf.descripcion || "Sin indicaciones adicionales."}</p></div><span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-black ${status === "Disponible" ? "bg-emerald-500/10 text-emerald-300" : "bg-red-500/10 text-red-300"}`}>{status === "Disponible" ? <CheckCircle2 size={15} /> : <XCircle size={15} />}{status}</span></div>
        <div className="border-t border-zinc-800 p-5 sm:p-6"><div className="mb-2 flex justify-between text-sm"><span className="font-bold text-zinc-300">Ocupación de huecos</span><span className="font-mono font-black text-white">{shelf.ocupados} / {shelf.capacidad_maxima} · {shelf.porcentaje_ocupacion}%</span></div><div className="h-3 overflow-hidden rounded-full bg-zinc-800"><div className={`h-full ${shelf.llena ? "bg-red-500" : shelf.porcentaje_ocupacion >= 80 ? "bg-amber-500" : "bg-emerald-500"}`} style={{ width: `${shelf.porcentaje_ocupacion}%` }} /></div></div>
      </section>

      <section className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6"><Summary icon={<Layers3 />} label="Niveles" value={shelf.niveles} /><Summary icon={<Box />} label="Huecos libres" value={shelf.disponibles} tone="emerald" /><Summary icon={<PackageOpen />} label="Piezas directas" value={directPieces} tone="amber" /><Summary icon={<Archive />} label="Cajones" value={drawers.length} tone="cyan" /><Summary icon={<Warehouse />} label="En cajones" value={piecesInDrawers} tone="cyan" /><Summary icon={<MapPin />} label="Siguiente hueco" value={shelf.siguiente_ubicacion ? shortLocation(shelf.siguiente_ubicacion) : "Ninguno"} /></section>

      <section className="space-y-4"><div><h2 className="text-2xl font-black text-white">Contenido por niveles</h2><p className="text-sm text-zinc-500">Los niveles se muestran desde el más alto hasta el más bajo.</p></div>{byLevel.map(([level, slots]) => <LevelCard key={level} shelf={shelf} level={Number(level)} slots={slots || []} />)}</section>
    </div>
  </main>;
}

function LevelCard({ shelf, level, slots }: { shelf: EstanteriaPlanoAlmacen; level: number; slots: HuecoPlanoAlmacen[] }) {
  const occupied = slots.filter((slot) => slot.pieza || slot.cajon).length;
  const rule = shelf.reglas_nivel.find((item) => level >= item.nivel_desde && level <= item.nivel_hasta);
  return <article className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900"><header className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800 px-4 py-3 sm:px-5"><div><div className="flex items-center gap-2"><h3 className="text-lg font-black text-cyan-300">Nivel {level}</h3><span className="rounded-full bg-zinc-950 px-2 py-1 text-[10px] font-bold text-zinc-400">{occupied}/{slots.length} ocupados</span></div><p className="mt-1 text-sm text-zinc-400">{rule?.contenido || [...(rule?.categorias || []), ...(rule?.palabras_clave || [])].join(", ") || "Sin contenido específico configurado"}</p></div><span className="text-xs font-bold text-emerald-300">{slots.filter((slot) => slot.disponible).length} libres</span></header><div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{slots.sort((left, right) => left.hueco - right.hueco).map((slot) => <SlotDetail key={slot.ubicacion} slot={slot} />)}</div></article>;
}

function SlotDetail({ slot }: { slot: HuecoPlanoAlmacen }) {
  const heading = `Hueco ${slot.hueco}`;
  if (slot.cajon) return <Link href={`/almacen-desguace/cajones/${slot.cajon.id}`} className="rounded-xl border border-cyan-500/30 bg-cyan-500/5 p-3 transition hover:bg-cyan-500/10"><div className="flex items-center justify-between gap-2"><p className="text-xs font-black uppercase text-cyan-300">{heading} · Cajón</p><Archive size={16} className="text-cyan-400" /></div><p className="mt-2 font-mono font-black text-amber-300">{slot.cajon.codigo}</p><p className="truncate font-bold text-white">{slot.cajon.nombre}</p><p className="mt-1 text-xs text-zinc-500">{slot.cajon.cantidad_piezas}/{slot.cajon.capacidad_maxima} piezas · {slot.cajon.lleno ? "Lleno" : "Con espacio"}</p></Link>;
  if (slot.pieza) return <Link href={`/almacen-desguace/${slot.pieza.id}`} className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 transition hover:bg-amber-500/10"><div className="flex items-center justify-between gap-2"><p className="text-xs font-black uppercase text-amber-300">{heading} · Pieza directa</p><PackageOpen size={16} className="text-amber-400" /></div><p className="mt-2 font-mono text-xs font-black text-white">{slot.pieza.codigo_interno}</p><p className="line-clamp-2 font-bold text-white">{slot.pieza.nombre_pieza || "Pieza sin nombre"}</p><p className="mt-1 text-xs text-zinc-500">{slot.pieza.categoria || "Sin categoría"}</p></Link>;
  if (slot.disponible) return <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/5 p-3"><p className="text-xs font-black uppercase text-emerald-300">{heading}</p><p className="mt-2 flex items-center gap-2 font-bold text-emerald-200"><CheckCircle2 size={17} /> Libre</p><p className="mt-1 font-mono text-[10px] text-zinc-600">{slot.ubicacion}</p></div>;
  return <div className="rounded-xl border border-zinc-700 bg-zinc-950 p-3"><p className="text-xs font-black uppercase text-zinc-500">{heading}</p><p className="mt-2 font-bold text-zinc-500">No disponible</p><p className="mt-1 font-mono text-[10px] text-zinc-700">{slot.ubicacion}</p></div>;
}

function Summary({ icon, label, value, tone = "zinc" }: { icon: React.ReactNode; label: string; value: React.ReactNode; tone?: "zinc" | "emerald" | "amber" | "cyan" }) {
  const colors = { zinc: "border-zinc-800 text-zinc-400", emerald: "border-emerald-500/20 text-emerald-300", amber: "border-amber-500/20 text-amber-300", cyan: "border-cyan-500/20 text-cyan-300" };
  return <div className={`min-w-0 rounded-xl border bg-zinc-900 p-3 ${colors[tone]}`}><span className="[&>svg]:h-5 [&>svg]:w-5">{icon}</span><p className="mt-2 truncate text-[9px] font-black uppercase tracking-wide text-zinc-500 sm:text-[10px]">{label}</p><p className="mt-0.5 truncate text-lg font-black text-white">{value}</p></div>;
}

function shortLocation(location: string) {
  const match = location.match(/-N(\d{2})-C(\d{2})$/);
  return match ? `N${Number(match[1])} · H${Number(match[2])}` : location;
}
