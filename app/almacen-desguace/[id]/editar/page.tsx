import { notFound } from "next/navigation";
import ModuleHeader from "@/components/almacen-desguace/ModuleHeader";
import PieceForm from "@/components/almacen-desguace/PieceForm";
import { getPieza } from "@/lib/almacen-desguace-data";

export const dynamic = "force-dynamic";
export default async function EditarPiezaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const pieza = await getPieza(id).catch(() => null);
  if (!pieza) notFound();
  return <main className="min-h-screen bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950"><ModuleHeader title={`Editar ${pieza.codigo_interno}`} subtitle={pieza.nombre_pieza || "Borrador sin identificar"} /><div className="mx-auto max-w-6xl px-4 py-6 sm:px-6"><PieceForm pieza={pieza} /></div></main>;
}
