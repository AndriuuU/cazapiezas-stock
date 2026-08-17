import { Loader2 } from "lucide-react";
import ModuleHeader from "@/components/almacen-desguace/ModuleHeader";

export default function LoadingWarehouseSummary() {
  return <main className="min-h-screen bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950" aria-busy="true" aria-live="polite">
    <ModuleHeader title="Resumen del almacén" subtitle="Incidencias, capacidad y actividad reciente" />
    <div className="mx-auto max-w-[1500px] px-4 py-6 sm:px-6">
      <div className="flex min-h-72 flex-col items-center justify-center rounded-2xl border border-cyan-500/20 bg-zinc-900/70 p-8 text-center">
        <span className="grid h-20 w-20 place-items-center rounded-full border border-cyan-500/20 bg-cyan-500/10 text-cyan-300"><Loader2 className="animate-spin" size={36} aria-hidden="true" /></span>
        <h1 className="mt-5 text-2xl font-black text-white">Preparando el resumen</h1>
        <p className="mt-2 text-sm text-zinc-500">Calculando incidencias, ocupación y actividad reciente.</p>
      </div>
    </div>
  </main>;
}
