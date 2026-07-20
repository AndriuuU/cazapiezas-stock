import { notFound } from "next/navigation";
import PieceDetail from "@/components/almacen-desguace/PieceDetail";
import { getPieza, withPublicPhotos } from "@/lib/almacen-desguace-data";
import { getLocationHistory } from "@/lib/almacen-desguace-historial";

export const dynamic = "force-dynamic";
export default async function FichaPiezaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [pieza, movements] = await Promise.all([
    getPieza(id).catch(() => null),
    getLocationHistory({ pieceId: id, limit: 100 }).catch(() => []),
  ]);
  if (!pieza) notFound();
  return <PieceDetail pieza={await withPublicPhotos(pieza)} movements={movements} />;
}
