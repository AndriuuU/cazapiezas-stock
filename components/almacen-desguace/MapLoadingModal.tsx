import { LoaderCircle, MapPinned } from "lucide-react";

export default function MapLoadingModal() {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Abriendo la ubicación en el plano"
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 px-5 backdrop-blur-sm"
    >
      <div className="w-full max-w-sm rounded-3xl border border-cyan-500/30 bg-zinc-950 p-6 text-center shadow-2xl shadow-cyan-950/40">
        <div className="relative mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-cyan-500/30 bg-cyan-500/10">
          <MapPinned className="text-cyan-300" size={30} />
          <LoaderCircle className="absolute -inset-1 h-[72px] w-[72px] animate-spin text-cyan-500" strokeWidth={1.5} />
        </div>
        <p className="mt-5 text-lg font-black text-white">Localizando en el plano</p>
        <p className="mt-1.5 text-sm leading-5 text-zinc-400">
          Estamos abriendo la estantería, el nivel y el hueco exactos.
        </p>
      </div>
    </div>
  );
}
