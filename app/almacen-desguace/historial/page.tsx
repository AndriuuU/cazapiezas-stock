/* eslint-disable @next/next/no-html-link-for-pages */
import Link from "next/link";
import { ArrowLeft, Database, History } from "lucide-react";
import AuditHistory from "@/components/almacen-desguace/AuditHistory";
import ModuleHeader from "@/components/almacen-desguace/ModuleHeader";
import MovementHistory from "@/components/almacen-desguace/MovementHistory";
import WarehouseAdminLinks from "@/components/almacen-desguace/WarehouseAdminLinks";
import { getAuditHistory } from "@/lib/almacen-desguace-auditoria";
import { getLocationHistory } from "@/lib/almacen-desguace-historial";
import type { EventoAlmacen } from "@/types/almacen-desguace";

export const dynamic = "force-dynamic";

export default async function HistorialAlmacenPage() {
  let movements;
  try {
    movements = await getLocationHistory({ limit: 500 });
  } catch {
    return <main className="min-h-screen bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950"><ModuleHeader title="Historial de ubicaciones" subtitle="Consulta colocaciones, traslados, retiradas e incidencias" /><div className="mx-auto max-w-3xl space-y-5 px-4 py-6 sm:px-6"><Link href="/almacen-desguace" className="inline-flex items-center gap-2 text-sm font-semibold text-zinc-400 hover:text-white"><ArrowLeft size={17} /> Volver a las piezas</Link><section className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-6"><Database className="mb-3 text-amber-300" size={32} /><h1 className="text-xl font-black text-white">Falta preparar la base de datos</h1><p className="mt-2 text-sm leading-6 text-amber-100/80">Aplica la migración <strong>202607200002_historial_y_plano_almacen.sql</strong> para activar el historial automático.</p></section></div></main>;
  }
  let events: EventoAlmacen[] = [];
  let auditReady = true;
  try {
    events = await getAuditHistory({ limit: 1000 });
  } catch {
    auditReady = false;
  }

  return <main className="min-h-screen bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950">
    <ModuleHeader title="Historial completo del almacén" subtitle="Cambios, cajones, estados, fotografías y publicaciones en Recambio Fácil" />
    <div className="mx-auto max-w-6xl space-y-5 px-4 py-6 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/almacen-desguace" className="inline-flex items-center gap-2 text-sm font-semibold text-zinc-400 hover:text-white"><ArrowLeft size={17} /> Volver a las piezas</Link>
        <div className="flex flex-wrap items-center gap-2"><WarehouseAdminLinks /><span className="inline-flex items-center gap-2 rounded-full bg-cyan-500/10 px-3 py-1.5 text-sm font-bold text-cyan-300"><History size={16} /> {events.length} eventos recientes</span></div>
      </div>

      {!auditReady
        ? <section className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-5"><Database className="mb-2 text-amber-300" size={26} /><h1 className="font-black text-white">Falta activar el historial completo</h1><p className="mt-1 text-sm text-amber-100/80">Aplica la migración <strong>202607230001_auditoria_completa_almacen.sql</strong>. El historial de ubicaciones anterior sigue disponible debajo.</p></section>
        : <section className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4 sm:p-5"><div className="mb-4"><h1 className="text-xl font-black text-white">Actividad completa</h1><p className="text-sm text-zinc-500">Se conservan los valores anteriores y nuevos de cada modificación. La pantalla muestra los 1.000 eventos más recientes.</p></div><AuditHistory events={events} /></section>}

      <details className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4 sm:p-5">
        <summary className="cursor-pointer font-black text-zinc-200">Historial anterior de ubicaciones · {movements.length} movimientos</summary>
        <div className="mt-4"><MovementHistory movements={movements} /></div>
      </details>
    </div>
  </main>;
}
