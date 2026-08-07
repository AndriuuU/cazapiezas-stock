import IamImporter from "@/components/almacen-desguace/IamImporter";
import ModuleHeader from "@/components/almacen-desguace/ModuleHeader";

export default function ImportarIamPage() {
  return <main className="min-h-screen bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950"><ModuleHeader title="Importar piezas IAM" subtitle="Desde Recambio Fácil o desde un fichero CSV" /><div className="mx-auto max-w-5xl px-4 py-6 sm:px-6"><IamImporter /></div></main>;
}
