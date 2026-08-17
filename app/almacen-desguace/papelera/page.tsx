import Link from "next/link";
import { ArrowLeft, Trash2 } from "lucide-react";
import ModuleHeader from "@/components/almacen-desguace/ModuleHeader";
import TrashRestoreButton from "@/components/almacen-desguace/TrashRestoreButton";
import { getAuditHistory } from "@/lib/almacen-desguace-auditoria";

export const dynamic = "force-dynamic";

export default async function TrashPage() {
  const events = await getAuditHistory({ limit: 2000 }).catch(() => []);
  const restoredDeletionIds = new Set(events.filter((event) => event.metadata?.operacion === "papelera_restaurada").map((event) => Number(event.metadata?.eliminacion_evento_id)));
  const deleted = events.filter((event) => event.tipo_evento === "eliminacion_pieza" && event.valor_anterior && !restoredDeletionIds.has(event.id));
  return <main className="min-h-screen bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950"><ModuleHeader title="Papelera" subtitle="Recupera piezas eliminadas accidentalmente" /><div className="mx-auto max-w-5xl space-y-5 px-4 py-6 sm:px-6"><Link href="/almacen-desguace/historial" className="inline-flex items-center gap-2 text-sm font-bold text-zinc-400 hover:text-white"><ArrowLeft size={17} /> Volver al historial</Link><section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5"><div className="mb-5 flex items-center gap-3"><Trash2 className="text-red-300" /><div><h1 className="text-xl font-black text-white">Piezas eliminadas</h1><p className="text-sm text-zinc-500">La recuperación restaura los datos principales. Las imágenes borradas físicamente pueden no estar disponibles.</p></div></div>{deleted.length ? <div className="space-y-3">{deleted.map((event) => <article key={event.id} className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-zinc-800 bg-zinc-950 p-4"><div><p className="font-mono font-black text-amber-300">{event.pieza_codigo}</p><p className="font-bold text-white">{event.pieza_nombre || "Pieza sin nombre"}</p><p className="mt-1 text-xs text-zinc-500">Eliminada el {new Date(event.created_at).toLocaleString("es-ES")}</p></div><TrashRestoreButton eventId={event.id} /></article>)}</div> : <div className="rounded-xl border border-dashed border-zinc-700 p-8 text-center text-zinc-500">La papelera está vacía.</div>}</section></div></main>;
}
