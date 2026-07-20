import WarehouseMap from "@/components/almacen-desguace/WarehouseMap";
import { getWarehousePlan } from "@/lib/almacen-desguace-estanterias";
import Link from "next/link";
import { ArrowLeft, Database } from "lucide-react";
import ModuleHeader from "@/components/almacen-desguace/ModuleHeader";

export const dynamic = "force-dynamic";

export default async function PlanoAlmacenPage() {
  let shelves;
  try {
    shelves = await getWarehousePlan();
  } catch {
    return <main className="min-h-screen bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950"><ModuleHeader title="Plano general del almacén" subtitle="Zonas, estanterías y huecos disponibles de un vistazo" /><div className="mx-auto max-w-3xl space-y-5 px-4 py-6 sm:px-6"><Link href="/almacen-desguace" className="inline-flex items-center gap-2 text-sm font-semibold text-zinc-400 hover:text-white"><ArrowLeft size={17} /> Volver a las piezas</Link><section className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-6"><Database className="mb-3 text-amber-300" size={32} /><h1 className="text-xl font-black text-white">Falta preparar la base de datos</h1><p className="mt-2 text-sm leading-6 text-amber-100/80">Aplica la migración <strong>202607200002_historial_y_plano_almacen.sql</strong> y vuelve a abrir esta pantalla.</p></section></div></main>;
  }
  return <WarehouseMap shelves={shelves} />;
}
