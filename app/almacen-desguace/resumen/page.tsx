import Link from "next/link";
import { ArrowLeft, Database } from "lucide-react";
import ModuleHeader from "@/components/almacen-desguace/ModuleHeader";
import WarehouseSummaryDashboard from "@/components/almacen-desguace/WarehouseSummaryDashboard";
import { getWarehouseSummary } from "@/lib/almacen-desguace-resumen";

export const dynamic = "force-dynamic";

export default async function WarehouseSummaryPage() {
  let result: Awaited<ReturnType<typeof getWarehouseSummary>> | null = null;
  let loadError: unknown;
  try {
    result = await getWarehouseSummary();
  } catch (error) {
    loadError = error;
  }

  if (result) {
    return <main className="min-h-screen bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950">
      <ModuleHeader title="Resumen del almacén" subtitle="Incidencias, capacidad y actividad reciente" />
      <div className="mx-auto max-w-[1500px] px-4 py-5 sm:px-6 sm:py-6">
        <WarehouseSummaryDashboard summary={result} />
      </div>
    </main>;
  }

  return <main className="min-h-screen bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950">
    <ModuleHeader title="Resumen del almacén" subtitle="Incidencias, capacidad y actividad reciente" />
    <div className="mx-auto max-w-3xl space-y-5 px-4 py-6 sm:px-6">
      <Link href="/almacen-desguace" className="inline-flex items-center gap-2 text-sm font-semibold text-zinc-400 hover:text-white"><ArrowLeft size={17} /> Volver a las piezas</Link>
      <section className="rounded-2xl border border-red-500/30 bg-red-500/10 p-6">
        <Database className="mb-3 text-red-300" size={32} />
        <h1 className="text-xl font-black text-white">No se ha podido cargar el resumen</h1>
        <p className="mt-2 text-sm leading-6 text-red-100/80">{loadError instanceof Error ? loadError.message : "Comprueba la conexión con la base de datos y vuelve a intentarlo."}</p>
      </section>
    </div>
  </main>;
}
