import { LoaderCircle, MapPinned } from "lucide-react";

export default function MapLoadingModal() {
  return (
    <section
      role="status"
      aria-live="polite"
      aria-label="Abriendo la ubicación en el plano"
      className="flex min-h-72 items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-900/80 p-5"
    >
      <div className="w-full max-w-xs rounded-2xl border border-cyan-500/30 bg-zinc-950 p-4 text-center shadow-xl shadow-cyan-950/30">
        <div className="relative mx-auto flex h-12 w-12 items-center justify-center rounded-xl border border-cyan-500/30 bg-cyan-500/10">
          <MapPinned className="text-cyan-300" size={23} />
          <LoaderCircle className="absolute -inset-1 h-14 w-14 animate-spin text-cyan-500" strokeWidth={1.5} />
        </div>
        <p className="mt-3 font-black text-white">Localizando en el plano</p>
        <p className="mt-1 text-xs leading-5 text-zinc-400">
          Estamos abriendo la estantería, el nivel y el hueco exactos.
        </p>
      </div>
    </section>
  );
}
