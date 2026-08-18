import { ArrowDown, MapPin, PackageMinus, RotateCcw, ShoppingBag, UploadCloud } from "lucide-react";
import type { EventoAlmacen, MovimientoUbicacion, PiezaDesguace } from "@/types/almacen-desguace";

type Step = { key: string; title: string; detail: string; date: string; tone: string; icon: React.ReactNode };

export default function PieceTimeline({ pieza, events, movements }: { pieza: PiezaDesguace; events: EventoAlmacen[]; movements: MovimientoUbicacion[] }) {
  const chronological = [...events].sort((a, b) => a.created_at.localeCompare(b.created_at));
  const firstLocation = [...movements].sort((a, b) => a.created_at.localeCompare(b.created_at)).find((item) => item.ubicacion_final);
  const publication = chronological.find((event) => event.tipo_evento === "publicacion_rf" && event.exito) || chronological.find((event) => event.tipo_evento === "cambio_online" && event.valor_nuevo?.publicado_online === true);
  const sale = chronological.findLast((event) => event.metadata?.operacion === "venta" || event.accion === "Venta registrada");
  const returned = chronological.findLast((event) => event.metadata?.operacion === "venta_anulada" || event.valor_nuevo?.estado_proceso === "Devuelta");
  const removed = chronological.findLast((event) => event.valor_nuevo?.estado_proceso === "Retirada");
  const steps: Step[] = [{ key: "entry", title: "Entrada", detail: "Pieza registrada en el almacén", date: pieza.created_at || pieza.fecha_entrada, tone: "bg-amber-500 text-zinc-950", icon: <ArrowDown size={18} /> }];
  if (firstLocation) steps.push({ key: "location", title: "Ubicación", detail: firstLocation.ubicacion_final || "Ubicación asignada", date: firstLocation.created_at, tone: "bg-cyan-500 text-zinc-950", icon: <MapPin size={18} /> });
  if (publication) steps.push({ key: "publication", title: "Publicación", detail: publication.accion, date: publication.created_at, tone: "bg-violet-500 text-white", icon: <UploadCloud size={18} /> });
  if (sale) steps.push({ key: "sale", title: "Venta", detail: `${String(sale.valor_nuevo?.empleado || sale.usuario_nombre)} · ${Number(sale.valor_nuevo?.precio_final || 0).toFixed(2)} € sin IVA`, date: String(sale.valor_nuevo?.fecha_venta || sale.created_at), tone: "bg-emerald-500 text-zinc-950", icon: <ShoppingBag size={18} /> });
  if (returned) steps.push({ key: "return", title: "Devolución", detail: returned.detalle || returned.accion, date: returned.created_at, tone: "bg-blue-500 text-white", icon: <RotateCcw size={18} /> });
  if (removed) steps.push({ key: "removed", title: "Retirada", detail: removed.detalle || "Pieza retirada del almacén", date: removed.created_at, tone: "bg-red-500 text-white", icon: <PackageMinus size={18} /> });

  return <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5"><div className="mb-5"><h2 className="font-black text-white">Línea temporal de la pieza</h2><p className="text-xs text-zinc-500">Entrada, ubicación, publicación y salida en una sola vista.</p></div><ol className="grid gap-0 sm:grid-cols-2 lg:grid-cols-6">{steps.map((step, index) => <li key={`${step.key}-${step.date}`} className="relative flex gap-3 pb-5 sm:pr-4 lg:block lg:pb-0"><div className="relative z-10 flex flex-col items-center lg:flex-row"><span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${step.tone}`}>{step.icon}</span>{index < steps.length - 1 && <span className="h-full w-px bg-zinc-700 lg:h-px lg:min-w-6 lg:flex-1" />}</div><div className="min-w-0 lg:mt-3"><h3 className="font-black text-zinc-100">{step.title}</h3><p className="mt-1 text-sm text-zinc-400">{step.detail}</p><time className="mt-1 block text-xs text-zinc-600">{new Date(step.date).toLocaleString("es-ES")}</time></div></li>)}</ol></section>;
}
