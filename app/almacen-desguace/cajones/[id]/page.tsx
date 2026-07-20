import { notFound } from "next/navigation";
import DrawerDetail from "@/components/almacen-desguace/DrawerDetail";
import { getDrawer } from "@/lib/almacen-desguace-cajones";

export const dynamic = "force-dynamic";
export default async function CajonPage({ params }: { params: Promise<{ id: string }> }) {
  const drawer = await getDrawer((await params).id);
  if (!drawer) notFound();
  return <DrawerDetail initialDrawer={drawer} />;
}
