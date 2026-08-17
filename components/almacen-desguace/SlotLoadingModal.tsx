import { Box, LoaderCircle } from "lucide-react";

export default function SlotLoadingModal({ destination }: { destination: "pieza" | "cajón" }) {
  return <div role="status" aria-live="polite" aria-label={`Abriendo ${destination}`} className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 px-5 backdrop-blur-sm"><div className="w-full max-w-sm rounded-3xl border border-cyan-500/30 bg-zinc-950 p-6 text-center shadow-2xl shadow-cyan-950/40"><div className="relative mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-cyan-500/30 bg-cyan-500/10"><Box className="text-cyan-300" size={30} /><LoaderCircle className="absolute -inset-1 h-[72px] w-[72px] animate-spin text-cyan-500" strokeWidth={1.5} /></div><p className="mt-5 text-lg font-black text-white">Abriendo {destination}</p><p className="mt-1.5 text-sm leading-5 text-zinc-400">Cargando los datos y movimientos de esta ubicación.</p></div></div>;
}
