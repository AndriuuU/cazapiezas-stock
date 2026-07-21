"use client";

import { useMemo, useState } from "react";
import { MapPin, Search, Warehouse } from "lucide-react";

export type FreeWarehouseLocation = {
  ubicacion: string;
  zona: string;
  estanteria_codigo: string;
  estanteria_nombre: string;
  nivel: number;
  hueco: number;
};

function normalize(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

export default function AvailableLocationPicker({ locations, value, onChange }: {
  locations: FreeWarehouseLocation[];
  value: string;
  onChange: (location: string) => void;
}) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const term = normalize(query.trim());
    if (!term) return locations;
    return locations.filter((location) => normalize([
      location.ubicacion,
      location.zona,
      location.estanteria_codigo,
      location.estanteria_nombre,
      `nivel ${location.nivel}`,
      `hueco ${location.hueco}`,
    ].join(" ")).includes(term));
  }, [locations, query]);
  const groups = useMemo(() => {
    const grouped = new Map<string, FreeWarehouseLocation[]>();
    filtered.forEach((location) => {
      const key = `${location.zona}|||${location.estanteria_codigo}|||${location.estanteria_nombre}`;
      grouped.set(key, [...(grouped.get(key) || []), location]);
    });
    return [...grouped.entries()];
  }, [filtered]);

  return <div className="space-y-3">
    <label className="relative block"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar zona, estantería, nivel o hueco..." className="w-full rounded-xl border border-zinc-700 bg-zinc-900 py-3 pl-10 pr-4 text-white outline-none focus:border-amber-500" /></label>
    <div className="flex items-center justify-between text-xs text-zinc-500"><span>{filtered.length} huecos disponibles</span>{value && <span className="font-mono font-bold text-amber-300">Elegido: {value}</span>}</div>
    <div className="max-h-[42vh] space-y-3 overflow-y-auto pr-1">
      {groups.map(([key, group]) => {
        const [zone, shelfCode, shelfName] = key.split("|||");
        const levels = Object.groupBy(group, (location) => location.nivel);
        return <article key={key} className="overflow-hidden rounded-xl border border-zinc-700 bg-zinc-900">
          <header className="flex items-center justify-between gap-3 border-b border-zinc-800 px-3 py-2.5"><div className="flex min-w-0 items-center gap-2"><Warehouse className="shrink-0 text-cyan-400" size={17} /><div className="min-w-0"><p className="truncate font-bold text-white">{zone} · {shelfCode}</p><p className="truncate text-xs text-zinc-500">{shelfName}</p></div></div><span className="shrink-0 rounded-full bg-emerald-500/10 px-2 py-1 text-xs font-bold text-emerald-300">{group.length} libres</span></header>
          <div className="space-y-2 p-3">{Object.entries(levels).map(([level, slots]) => <div key={level} className="grid grid-cols-[62px_1fr] items-start gap-2"><p className="pt-2 text-xs font-bold text-cyan-300">Nivel {level}</p><div className="flex flex-wrap gap-2">{slots?.map((slot) => {
            const selected = value === slot.ubicacion;
            return <button type="button" key={slot.ubicacion} onClick={() => onChange(slot.ubicacion)} title={slot.ubicacion} aria-pressed={selected} className={`inline-flex min-h-9 min-w-12 items-center justify-center rounded-lg border px-2 font-mono text-xs font-black transition ${selected ? "border-amber-300 bg-amber-500 text-zinc-950 ring-2 ring-amber-500/20" : "border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:border-emerald-300 hover:bg-emerald-500/20"}`}>H{String(slot.hueco).padStart(2, "0")}</button>;
          })}</div></div>)}</div>
        </article>;
      })}
      {!groups.length && <div className="rounded-xl border border-dashed border-zinc-700 py-10 text-center text-zinc-500"><MapPin className="mx-auto mb-2" size={32} /><p className="font-bold text-zinc-300">No hay huecos disponibles.</p><p className="mt-1 text-sm">Prueba otra búsqueda o revisa las estanterías.</p></div>}
    </div>
  </div>;
}
