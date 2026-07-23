"use client";

import Link from "next/link";
import { MapPin } from "lucide-react";
import { useState, type MouseEvent } from "react";
import MapLoadingModal from "@/components/almacen-desguace/MapLoadingModal";

function locationParts(location: string) {
  const match = location.match(/^DESGUACE-(E\d{2})-N(\d{2})-C(\d{2})$/);
  return match ? { shelf: match[1], level: Number(match[2]), slot: Number(match[3]) } : null;
}

export default function WarehouseLocationLink({ location, compact = false, prominent = false }: { location: string | null | undefined; compact?: boolean; prominent?: boolean }) {
  const [openingMap, setOpeningMap] = useState(false);

  if (!location) return <span className="text-zinc-500">Sin ubicar</span>;
  const parts = locationParts(location);
  if (!parts) return <span className="font-mono text-cyan-300">{location}</span>;

  const href = `/almacen-desguace/plano?estanteria=${parts.shelf}&ubicacion=${encodeURIComponent(location)}#plano-fisico`;
  const startOpening = (event: MouseEvent<HTMLAnchorElement>) => {
    if (event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) {
      setOpeningMap(true);
    }
  };

  return <>
  <Link href={href} onClick={startOpening} title={`Mostrar ${parts.shelf}, nivel ${parts.level}, hueco ${parts.slot} en el plano`} className={`group/location inline-flex items-center gap-1.5 rounded-lg border font-bold text-cyan-200 transition ${prominent ? "min-h-12 w-full justify-center border-zinc-700 bg-zinc-950 px-4 py-3 text-sm hover:border-cyan-500/50 hover:bg-zinc-800" : `border-cyan-500/20 bg-cyan-500/5 hover:border-cyan-400/60 hover:bg-cyan-500/15 ${compact ? "px-2 py-1 text-[10px]" : "px-2.5 py-1.5 text-xs"}`}`}>
    <MapPin size={prominent ? 18 : compact ? 12 : 14} className="shrink-0 text-cyan-400" />
    <span>{parts.shelf} · N{parts.level} · H{parts.slot}</span>
  </Link>
  {openingMap && <MapLoadingModal />}
  </>;
}
