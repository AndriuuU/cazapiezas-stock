import WarehouseList from "@/components/almacen-desguace/WarehouseList";

export default async function AlmacenDesguacePage({ searchParams }: { searchParams: Promise<{ view?: string | string[] }> }) {
  const requestedView = (await searchParams).view;
  const initialView = requestedView === "vendidas" || requestedView === "retiradas" ? requestedView : "almacen";
  return <WarehouseList key={initialView} initialView={initialView} />;
}
