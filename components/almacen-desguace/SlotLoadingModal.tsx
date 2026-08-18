import { Box, LoaderCircle } from "lucide-react";

export default function SlotLoadingModal({ destination }: { destination: "pieza" | "cajón" }) {
  return <div role="status" aria-live="polite" aria-label={`Abriendo ${destination}`} className="fixed inset-x-0 bottom-0 top-0 z-20 flex items-center justify-center bg-black/65 px-5 sm:top-[61px]"><div className="w-full max-w-xs rounded-2xl border border-cyan-500/30 bg-zinc-950 p-4 text-center shadow-xl shadow-cyan-950/30"><div className="relative mx-auto flex h-12 w-12 items-center justify-center rounded-xl border border-cyan-500/30 bg-cyan-500/10"><Box className="text-cyan-300" size={23} /><LoaderCircle className="absolute -inset-1 h-14 w-14 animate-spin text-cyan-500" strokeWidth={1.5} /></div><p className="mt-3 font-black text-white">Abriendo {destination}</p><p className="mt-1 text-xs leading-5 text-zinc-400">Cargando los datos y movimientos de esta ubicación.</p></div></div>;
}
