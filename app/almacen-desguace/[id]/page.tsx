import { notFound } from "next/navigation";
import PieceDetail from "@/components/almacen-desguace/PieceDetail";
import { getPieza, withPublicPhotos } from "@/lib/almacen-desguace-data";

export const dynamic = "force-dynamic";
export default async function FichaPiezaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const pieza = await getPieza(id).catch(() => null);
  if (!pieza) notFound();
  return <PieceDetail pieza={await withPublicPhotos(pieza)} />;
}
