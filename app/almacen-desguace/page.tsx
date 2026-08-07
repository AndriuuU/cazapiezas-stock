import WarehouseList from "@/components/almacen-desguace/WarehouseList";

export default async function AlmacenDesguacePage({ searchParams }: { searchParams: Promise<{ view?: string | string[]; tipo_pieza?: string | string[] }> }) {
  const query = await searchParams;
  const requestedView = query.view;
  const initialView = requestedView === "vendidas" || requestedView === "retiradas" ? requestedView : "almacen";
  const initialType = query.tipo_pieza === "IAM" || query.tipo_pieza === "CAT" ? query.tipo_pieza : "";
  return <WarehouseList key={`${initialView}-${initialType}`} initialView={initialView} initialType={initialType} />;
}
