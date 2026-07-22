import { notFound } from "next/navigation";
import PieceDetail from "@/components/almacen-desguace/PieceDetail";
import { getPieza, withPublicPhotos } from "@/lib/almacen-desguace-data";
import { getLocationHistory } from "@/lib/almacen-desguace-historial";

export const dynamic = "force-dynamic";
export default async function FichaPiezaPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ rf_error?: string | string[] }> }) {
  const { id } = await params;
  const query = await searchParams;
  const publicationError = typeof query.rf_error === "string" ? query.rf_error : undefined;
  const [pieza, movements] = await Promise.all([
    getPieza(id).catch(() => null),
    getLocationHistory({ pieceId: id, limit: 100 }).catch(() => []),
  ]);
  if (!pieza) notFound();
  return <PieceDetail pieza={await withPublicPhotos(pieza)} movements={movements} publicationError={publicationError} />;
}
