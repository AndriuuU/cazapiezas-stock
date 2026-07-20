import ModuleHeader from "@/components/almacen-desguace/ModuleHeader";
import PieceForm from "@/components/almacen-desguace/PieceForm";

export default function NuevaPiezaPage() {
  return <main className="min-h-screen bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950"><ModuleHeader title="Nueva pieza" subtitle="Puedes guardarla incompleta como borrador" /><div className="mx-auto max-w-6xl px-4 py-6 sm:px-6"><PieceForm /></div></main>;
}
