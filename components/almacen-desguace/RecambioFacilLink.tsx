import { ExternalLink } from "lucide-react";
import { getRecambioFacilReference, getRecambioFacilUrl } from "@/lib/recambio-facil";
import type { PiezaDesguace } from "@/types/almacen-desguace";

export default function RecambioFacilLink({ piece, compact = false }: { piece: PiezaDesguace; compact?: boolean }) {
  const url = getRecambioFacilUrl(piece);
  const reference = getRecambioFacilReference(piece);
  if (!url || !reference) return null;

  return <a href={url} target="_blank" rel="noopener noreferrer" title={`Buscar ${reference} en Recambio Fácil`} className={compact
    ? "inline-flex min-h-7 items-center justify-center gap-1 rounded-lg border border-violet-500/30 bg-violet-500/10 px-2 py-1 text-[10px] font-black text-violet-200 transition hover:border-violet-400 hover:bg-violet-500/20"
    : "inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-violet-500/30 bg-violet-500/10 px-4 py-2 text-sm font-black text-violet-100 transition hover:border-violet-400 hover:bg-violet-500/20"}>
    <ExternalLink size={compact ? 12 : 17} /> {compact ? "R/F" : "Ver en Recambio Fácil"}
  </a>;
}
