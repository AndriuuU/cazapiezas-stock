"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowRight, History, MapPin, PackageCheck, Search, Truck } from "lucide-react";
import type { MovimientoUbicacion, TipoMovimientoUbicacion } from "@/types/almacen-desguace";

const LABELS: Record<TipoMovimientoUbicacion, string> = {
  colocacion: "Colocación",
  traslado: "Traslado",
  retirada: "Retirada del hueco",
  incidencia: "Incidencia",
};

export default function MovementHistory({ movements, compact = false }: { movements: MovimientoUbicacion[]; compact?: boolean }) {
  const [query, setQuery] = useState("");
  const [type, setType] = useState("");
  const visible = useMemo(() => movements.filter((movement) => {
    if (type && movement.tipo_movimiento !== type) return false;
    const term = query.trim().toLowerCase();
    if (!term) return true;
    return [movement.pieza?.codigo_interno, movement.pieza?.nombre_pieza, movement.ubicacion_anterior, movement.ubicacion_final, movement.ubicacion_sugerida, movement.motivo, movement.usuario_nombre]
      .filter(Boolean).join(" ").toLowerCase().includes(term);
  }).slice(0, compact ? 8 : 500), [compact, movements, query, type]);

  return <section className="space-y-4">
    {!compact && <div className="grid gap-3 md:grid-cols-[1fr_240px]"><label className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={18} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar pieza, ubicación o motivo..." className="w-full rounded-xl border border-zinc-700 bg-zinc-950 py-3 pl-10 pr-4 text-white outline-none focus:border-cyan-500" /></label><select value={type} onChange={(event) => setType(event.target.value)} className="rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-3 text-white outline-none focus:border-cyan-500"><option value="">Todos los movimientos</option>{Object.entries(LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>}
    {visible.length === 0 ? <div className="rounded-2xl border border-dashed border-zinc-700 py-12 text-center"><History className="mx-auto mb-3 text-zinc-700" size={40} /><p className="font-bold text-zinc-300">No hay movimientos que mostrar.</p><p className="mt-1 text-sm text-zinc-500">Los cambios de ubicación aparecerán aquí automáticamente.</p></div> : <div className="relative space-y-3 before:absolute before:bottom-6 before:left-[19px] before:top-6 before:w-px before:bg-zinc-700">{visible.map((movement) => <MovementCard key={movement.id} movement={movement} compact={compact} />)}</div>}
  </section>;
}

function MovementCard({ movement, compact }: { movement: MovimientoUbicacion; compact: boolean }) {
  const type = movement.tipo_movimiento || (movement.resultado === "no_colocada" ? "incidencia" : "colocacion");
  const config = {
    colocacion: { icon: <PackageCheck size={17} />, color: "border-emerald-500/40 bg-emerald-500/15 text-emerald-300" },
    traslado: { icon: <Truck size={17} />, color: "border-cyan-500/40 bg-cyan-500/15 text-cyan-300" },
    retirada: { icon: <MapPin size={17} />, color: "border-zinc-600 bg-zinc-800 text-zinc-300" },
    incidencia: { icon: <AlertTriangle size={17} />, color: "border-red-500/40 bg-red-500/15 text-red-300" },
  }[type];
  const date = new Intl.DateTimeFormat("es-ES", { dateStyle: "medium", timeStyle: "short" }).format(new Date(movement.created_at));
  return <article className="relative grid grid-cols-[40px_1fr] gap-3"><span className={`relative z-10 flex h-10 w-10 items-center justify-center rounded-full border ${config.color}`}>{config.icon}</span><div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4"><div className="flex flex-wrap items-start justify-between gap-2"><div>{movement.pieza && !compact ? <Link href={`/almacen-desguace/${movement.pieza.id}`} className="font-bold text-white hover:text-amber-300">{movement.pieza.nombre_pieza || movement.pieza.codigo_interno}</Link> : <p className="font-bold text-white">{LABELS[type]}</p>}{movement.pieza && !compact && <p className="font-mono text-xs text-amber-300">{movement.pieza.codigo_interno}</p>}</div><div className="text-right"><span className={`rounded-full px-2 py-1 text-[11px] font-bold ${config.color}`}>{LABELS[type]}</span><p className="mt-1 text-xs text-zinc-500">{date}</p></div></div>
      <div className="mt-3 flex flex-wrap items-center gap-2 text-sm"><Location value={movement.ubicacion_anterior} empty="Sin ubicación" /><ArrowRight size={15} className="text-zinc-600" /><Location value={movement.ubicacion_final} empty={type === "incidencia" ? "No colocada" : "Sin ubicación"} /></div>
      {movement.motivo && <p className="mt-3 rounded-lg bg-zinc-950 px-3 py-2 text-sm text-zinc-300">{movement.motivo}</p>}
      <p className="mt-3 text-xs text-zinc-600">{movement.usuario_nombre || "Usuario de almacén"} · {movement.origen || "app"}</p>
    </div></article>;
}

function Location({ value, empty }: { value: string | null; empty: string }) { return <span className={`rounded-lg px-2.5 py-1.5 font-mono text-xs ${value ? "bg-cyan-500/10 text-cyan-200" : "bg-zinc-800 text-zinc-500"}`}>{value || empty}</span>; }
