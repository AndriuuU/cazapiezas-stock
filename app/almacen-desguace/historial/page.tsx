import Link from "next/link";
import { ArrowLeft, Database, History } from "lucide-react";
import ModuleHeader from "@/components/almacen-desguace/ModuleHeader";
import MovementHistory from "@/components/almacen-desguace/MovementHistory";
import { getLocationHistory } from "@/lib/almacen-desguace-historial";

export const dynamic = "force-dynamic";

export default async function HistorialAlmacenPage() {
  let movements;
  try {
    movements = await getLocationHistory({ limit: 500 });
  } catch {
    return <main className="min-h-screen bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950"><ModuleHeader title="Historial de ubicaciones" subtitle="Consulta colocaciones, traslados, retiradas e incidencias" /><div className="mx-auto max-w-3xl space-y-5 px-4 py-6 sm:px-6"><Link href="/almacen-desguace" className="inline-flex items-center gap-2 text-sm font-semibold text-zinc-400 hover:text-white"><ArrowLeft size={17} /> Volver a las piezas</Link><section className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-6"><Database className="mb-3 text-amber-300" size={32} /><h1 className="text-xl font-black text-white">Falta preparar la base de datos</h1><p className="mt-2 text-sm leading-6 text-amber-100/80">Aplica la migración <strong>202607200002_historial_y_plano_almacen.sql</strong> para activar el historial automático.</p></section></div></main>;
  }
  return <main className="min-h-screen bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950"><ModuleHeader title="Historial de ubicaciones" subtitle="Consulta colocaciones, traslados, retiradas e incidencias" /><div className="mx-auto max-w-6xl space-y-5 px-4 py-6 sm:px-6"><div className="flex flex-wrap items-center justify-between gap-3"><Link href="/almacen-desguace" className="inline-flex items-center gap-2 text-sm font-semibold text-zinc-400 hover:text-white"><ArrowLeft size={17} /> Volver a las piezas</Link><span className="inline-flex items-center gap-2 rounded-full bg-cyan-500/10 px-3 py-1.5 text-sm font-bold text-cyan-300"><History size={16} /> {movements.length} movimientos recientes</span></div><MovementHistory movements={movements} /></div></main>;
}
