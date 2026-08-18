import MapLoadingModal from "@/components/almacen-desguace/MapLoadingModal";
import ModuleHeader from "@/components/almacen-desguace/ModuleHeader";

export default function LoadingWarehouseMap() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950">
      <ModuleHeader title="Plano general del almacén" subtitle="Zonas, estanterías y huecos disponibles de un vistazo" />
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        <MapLoadingModal />
      </div>
    </main>
  );
}
