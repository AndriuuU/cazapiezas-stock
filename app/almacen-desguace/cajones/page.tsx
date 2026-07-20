import Link from "next/link";
import { ArrowLeft, Database } from "lucide-react";
import DrawerManager from "@/components/almacen-desguace/DrawerManager";
import ModuleHeader from "@/components/almacen-desguace/ModuleHeader";
import { getDrawers } from "@/lib/almacen-desguace-cajones";

export const dynamic = "force-dynamic";

export default async function CajonesPage() {
  let drawers;
  try { drawers = await getDrawers(); }
  catch { return <main className="min-h-screen bg-zinc-950"><ModuleHeader title="Cajones del almacén" subtitle="Varias piezas dentro de un hueco" /><div className="mx-auto max-w-3xl space-y-5 p-6"><Link href="/almacen-desguace" className="inline-flex items-center gap-2 text-zinc-400"><ArrowLeft size={17} /> Volver</Link><section className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-6"><Database className="mb-3 text-amber-300" /><h1 className="text-xl font-black text-white">Falta activar los cajones</h1><p className="mt-2 text-amber-100/80">Aplica la migración <strong>202607200003_cajones_almacen_desguace.sql</strong>.</p></section></div></main>; }
  return <DrawerManager initialDrawers={drawers} />;
}
