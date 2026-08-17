import { History } from "lucide-react";
import ModuleHeader from "@/components/almacen-desguace/ModuleHeader";

export default function LoadingWarehouseHistory() {
  return (
    <main
      className="min-h-screen bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950"
      aria-busy="true"
      aria-live="polite"
    >
      <ModuleHeader
        title="Historial completo del almacén"
        subtitle="Preparando cambios, movimientos y publicaciones"
      />

      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        <section className="overflow-hidden rounded-2xl border border-cyan-500/25 bg-zinc-900/70 shadow-2xl shadow-cyan-950/20">
          <div className="flex min-h-64 flex-col items-center justify-center px-6 py-12 text-center">
            <span className="relative grid h-24 w-24 place-items-center">
              <svg
                viewBox="0 0 100 100"
                className="absolute inset-0 h-full w-full animate-spin"
                aria-hidden="true"
              >
                <circle
                  cx="50"
                  cy="50"
                  r="45"
                  fill="none"
                  stroke="rgb(63 63 70)"
                  strokeWidth="6"
                />
                <circle
                  cx="50"
                  cy="50"
                  r="45"
                  fill="none"
                  stroke="rgb(34 211 238)"
                  strokeWidth="6"
                  strokeLinecap="round"
                  strokeDasharray="95 188"
                />
              </svg>
              <span className="grid h-16 w-16 place-items-center rounded-full border border-cyan-500/25 bg-cyan-500/10 text-cyan-300 shadow-lg shadow-cyan-950/40">
                <History size={30} aria-hidden="true" />
              </span>
            </span>
            <h1 className="mt-6 text-2xl font-black text-white">
              Cargando historial
            </h1>
            <p className="mt-2 max-w-md text-sm leading-6 text-zinc-400">
              Estamos recuperando los últimos cambios, movimientos y
              publicaciones del almacén.
            </p>
          </div>

          <div className="animate-pulse border-t border-zinc-800 p-4 sm:p-5">
            <div className="mb-4 h-5 w-40 rounded bg-zinc-800" />
            <div className="space-y-3">
              {["w-full", "w-11/12", "w-4/5"].map((width, index) => (
                <div
                  key={width}
                  className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4"
                >
                  <div className={`h-3 ${width} rounded bg-zinc-800`} />
                  <div
                    className={`mt-3 h-3 rounded bg-zinc-800/70 ${
                      index === 0 ? "w-2/3" : "w-1/2"
                    }`}
                  />
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
