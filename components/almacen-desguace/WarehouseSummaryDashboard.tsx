"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowRight,
  CameraOff,
  CheckCircle2,
  CirclePlus,
  CloudUpload,
  MapPinOff,
  PackageMinus,
  ShoppingBag,
  Warehouse,
} from "lucide-react";
import PlacementModal from "@/components/almacen-desguace/PlacementModal";
import type { SummaryIssue, WarehouseSummary } from "@/lib/almacen-desguace-resumen";
import type { PiezaDesguace } from "@/types/almacen-desguace";

const ISSUE_STYLES: Record<SummaryIssue, { active: string; icon: string }> = {
  location: { active: "border-cyan-400 bg-cyan-500/10", icon: "bg-cyan-500/10 text-cyan-300" },
  photos: { active: "border-amber-400 bg-amber-500/10", icon: "bg-amber-500/10 text-amber-300" },
  publish: { active: "border-violet-400 bg-violet-500/10", icon: "bg-violet-500/10 text-violet-300" },
  rf: { active: "border-red-400 bg-red-500/10", icon: "bg-red-500/10 text-red-300" },
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("es-ES", {
    timeZone: "Europe/Madrid",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export default function WarehouseSummaryDashboard({ summary }: { summary: WarehouseSummary }) {
  const router = useRouter();
  const [activeIssue, setActiveIssue] = useState<SummaryIssue>("location");
  const [placementPiece, setPlacementPiece] = useState<PiezaDesguace | null>(null);
  const [placedIds, setPlacedIds] = useState<Set<number>>(() => new Set());
  const [message, setMessage] = useState("");
  const visibleUnlocated = useMemo(
    () => summary.unlocated.filter((piece) => !placedIds.has(piece.id)),
    [placedIds, summary.unlocated],
  );
  const unlocatedCount = Math.max(0, summary.counts.unlocated - placedIds.size);

  const cards: Array<{
    key: SummaryIssue;
    value: number | string;
    label: string;
    note: string;
    icon: React.ReactNode;
  }> = [
    { key: "location", value: unlocatedCount, label: "Sin ubicación", note: "Necesitan estantería o cajón", icon: <MapPinOff /> },
    { key: "photos", value: summary.counts.missingPhotos, label: "CAT sin fotografías", note: "Las IAM usan imágenes de internet", icon: <CameraOff /> },
    { key: "publish", value: summary.counts.pendingPublish, label: "Pendientes de publicar", note: "CAT marcadas como listas para publicar", icon: <CloudUpload /> },
    {
      key: "rf",
      value: summary.auditReady ? summary.counts.rfProblems : "—",
      label: "Problemas con R/F",
      note: summary.auditReady ? "Último intento fallido o rechazado" : "Historial de auditoría no disponible",
      icon: <AlertTriangle />,
    },
  ];

  function placed(piece: PiezaDesguace, placedMessage: string) {
    setPlacedIds((current) => new Set(current).add(piece.id));
    setMessage(placedMessage);
    router.refresh();
  }

  return <>
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-white sm:text-3xl">Resumen del almacén</h1>
          <p className="mt-1 text-sm text-zinc-500">Lo que necesita atención y la actividad de hoy.</p>
        </div>
        <Link href="/almacen-desguace" className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-zinc-700 bg-zinc-900 px-4 font-bold text-zinc-200 hover:border-amber-500/50 hover:text-amber-300">
          <Warehouse size={18} /> Ver todas las piezas
        </Link>
      </div>

      {message && <div role="status" className="flex items-start justify-between gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm font-semibold text-emerald-200"><span className="flex items-center gap-2"><CheckCircle2 className="shrink-0" size={18} /> {message}</span><button type="button" onClick={() => setMessage("")} className="text-emerald-300 hover:text-white">Cerrar</button></div>}

      <section aria-label="Indicadores que necesitan atención" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => {
          const active = activeIssue === card.key;
          return <button
            type="button"
            key={card.key}
            aria-pressed={active}
            onClick={() => setActiveIssue(card.key)}
            className={`group rounded-2xl border p-4 text-left transition hover:-translate-y-0.5 hover:border-zinc-500 ${active ? ISSUE_STYLES[card.key].active : "border-zinc-800 bg-zinc-900"}`}
          >
            <span className="flex items-start justify-between gap-3"><span className={`rounded-xl p-2.5 ${ISSUE_STYLES[card.key].icon}`}>{card.icon}</span><ArrowRight className={`transition ${active ? "text-white" : "text-zinc-700 group-hover:text-zinc-400"}`} size={18} /></span>
            <strong className="mt-4 block text-3xl font-black text-white">{typeof card.value === "number" ? card.value.toLocaleString("es-ES") : card.value}</strong>
            <span className="mt-1 block font-black text-zinc-100">{card.label}</span>
            <span className="mt-1 block text-xs leading-5 text-zinc-500">{card.note}</span>
          </button>;
        })}
      </section>

      <IssuePanel
        active={activeIssue}
        summary={summary}
        visibleUnlocated={visibleUnlocated}
        onPlace={setPlacementPiece}
      />

      <div className="warehouse-summary-secondary-grid grid min-w-0 gap-4">
        <CapacityPanel items={summary.capacityAlerts} />
        <ActivityPanel summary={summary} />
      </div>
    </div>

    {placementPiece && <PlacementModal
      piece={placementPiece}
      onClose={() => setPlacementPiece(null)}
      onPlaced={(placedMessage) => placed(placementPiece, placedMessage)}
    />}

    <style jsx global>{`
      @media (min-width: 1024px) {
        .warehouse-summary-secondary-grid {
          grid-template-columns: minmax(0, 1.15fr) minmax(0, 0.85fr);
        }
      }
    `}</style>
  </>;
}

function CapacityPanel({ items }: { items: WarehouseSummary["capacityAlerts"] }) {
  return <section className="min-w-0 overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
    <h2 className="text-lg font-black text-white">Huecos y cajones casi llenos</h2>
    <p className="mt-1 text-sm text-zinc-500">Ubicaciones activas con una ocupación del 80 % o superior.</p>
    {items.length ? <div className="mt-5 space-y-4">{items.map((item) => <Link href={item.href} key={item.id} className="group block">
      <div className="mb-1.5 flex items-center justify-between gap-3 text-sm"><span className="min-w-0 truncate font-bold text-zinc-200 group-hover:text-cyan-300">{item.kind === "shelf" ? "Estantería" : "Cajón"} {item.code} · {item.name}</span><span className="shrink-0 text-xs text-zinc-500">{item.occupied}/{item.capacity} · {item.percentage}%</span></div>
      <div className="h-2 overflow-hidden rounded-full bg-zinc-800"><div className={`h-full rounded-full ${item.percentage >= 95 ? "bg-red-500" : "bg-amber-500"}`} style={{ width: `${item.percentage}%` }} /></div>
    </Link>)}</div> : <EmptyMessage text="No hay estanterías ni cajones por encima del 80 %." />}
  </section>;
}

function ActivityPanel({ summary }: { summary: WarehouseSummary }) {
  const labels = {
    entry: { label: "Nueva entrada", icon: <CirclePlus size={16} />, color: "text-emerald-300 bg-emerald-500/10" },
    sale: { label: "Pieza vendida", icon: <ShoppingBag size={16} />, color: "text-cyan-300 bg-cyan-500/10" },
    removed: { label: "Pieza retirada", icon: <PackageMinus size={16} />, color: "text-red-300 bg-red-500/10" },
  };
  return <section className="min-w-0 overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
    <h2 className="text-lg font-black text-white">Actividad reciente</h2>
    <p className="mt-1 text-sm text-zinc-500">Entradas, ventas y retiradas registradas.</p>
    <div
      className="mt-4 grid overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950"
      style={{ gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }}
    >
      <MiniStat label="Entradas hoy" value={summary.today.entries} />
      <MiniStat label="Ventas hoy" value={summary.today.sales} divided />
      <MiniStat label="Retiradas hoy" value={summary.today.removed} divided />
    </div>
    {summary.auditReady && summary.recentActivity.length ? <div className="mt-4 divide-y divide-zinc-800">{summary.recentActivity.slice(0, 3).map((activity) => {
      const item = labels[activity.kind];
      const content = <><span className={`rounded-lg p-2 ${item.color}`}>{item.icon}</span><span className="min-w-0 flex-1"><strong className="block truncate text-sm text-zinc-200">{item.label}</strong><span className="block truncate text-xs text-zinc-500">{activity.code} · {activity.name || "Pieza sin nombre"}</span></span><time className="shrink-0 text-[11px] text-zinc-600">{formatDate(activity.createdAt)}</time></>;
      return activity.pieceId ? <Link key={activity.id} href={`/almacen-desguace/${activity.pieceId}`} className="flex items-center gap-3 py-3 hover:text-white">{content}</Link> : <div key={activity.id} className="flex items-center gap-3 py-3">{content}</div>;
    })}</div> : <EmptyMessage text={summary.auditReady ? "Todavía no hay actividad reciente." : "Activa la auditoría completa para ver esta actividad."} />}
  </section>;
}

function MiniStat({ label, value, divided = false }: { label: string; value: number; divided?: boolean }) {
  return <div className={`min-w-0 px-2 py-2 text-center ${divided ? "border-l border-zinc-800" : ""}`}><strong className="block text-lg font-black leading-none text-white">{value.toLocaleString("es-ES")}</strong><span className="mt-1 block truncate text-[10px] font-bold text-zinc-500">{label}</span></div>;
}

function IssuePanel({ active, summary, visibleUnlocated, onPlace }: {
  active: SummaryIssue;
  summary: WarehouseSummary;
  visibleUnlocated: PiezaDesguace[];
  onPlace: (piece: PiezaDesguace) => void;
}) {
  const headers: Record<SummaryIssue, { title: string; description: string; count: number | null }> = {
    location: { title: "Piezas sin ubicación", description: "Asígnales una recomendación o elige cualquier hueco libre.", count: summary.counts.unlocated },
    photos: { title: "Piezas CAT sin fotografías", description: "Las IAM quedan fuera porque sus imágenes proceden de internet.", count: summary.counts.missingPhotos },
    publish: { title: "Pendientes de publicar", description: "Piezas CAT que están marcadas como listas para publicar en Recambio Fácil.", count: summary.counts.pendingPublish },
    rf: { title: "Problemas con Recambio Fácil", description: "El último intento registrado para estas piezas terminó con error. Un intento posterior correcto las elimina de aquí.", count: summary.auditReady ? summary.counts.rfProblems : null },
  };
  const header = headers[active];
  return <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4 sm:p-5">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><h2 className="text-xl font-black text-white">{header.title}</h2><p className="mt-1 text-sm text-zinc-500">{header.description}</p></div>
      {header.count != null && <span className="rounded-full bg-cyan-500/10 px-3 py-1.5 text-sm font-black text-cyan-300">{header.count.toLocaleString("es-ES")}</span>}
    </div>
    <div className="mt-4 overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950">
      {active === "location" && <PieceRows pieces={visibleUnlocated} empty="No quedan piezas sin ubicación." action={(piece) => <button type="button" onClick={() => onPlace(piece)} className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-cyan-500 px-3 text-sm font-black text-zinc-950 hover:bg-cyan-400"><MapPinOff size={16} /> Ubicar</button>} />}
      {active === "photos" && <PieceRows pieces={summary.missingPhotos} empty="Todas las piezas CAT tienen fotografías." action={(piece) => <Link href={`/almacen-desguace/${piece.id}#fotografias`} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 text-sm font-black text-amber-300 hover:bg-amber-500/20"><CameraOff size={16} /> Añadir fotos</Link>} />}
      {active === "publish" && <PieceRows pieces={summary.pendingPublish} empty="No hay piezas listas pendientes de publicar." action={(piece) => <Link href={`/almacen-desguace/${piece.id}`} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-violet-500/40 bg-violet-500/10 px-3 text-sm font-black text-violet-300 hover:bg-violet-500/20"><CloudUpload size={16} /> Abrir ficha</Link>} />}
      {active === "rf" && (summary.auditReady ? <RfProblemRows events={summary.rfProblems} /> : <EmptyMessage text="No se puede calcular este indicador hasta activar el historial de auditoría." />)}
    </div>
    {header.count != null && header.count > 20 && <p className="mt-3 text-center text-xs text-zinc-600">Se muestran las 20 más recientes de {header.count.toLocaleString("es-ES")}.</p>}
  </section>;
}

function PieceRows({ pieces, empty, action }: { pieces: PiezaDesguace[]; empty: string; action: (piece: PiezaDesguace) => React.ReactNode }) {
  if (!pieces.length) return <EmptyMessage text={empty} />;
  return <div className="divide-y divide-zinc-800">{pieces.map((piece) => <article key={piece.id} className="flex flex-wrap items-center gap-3 p-3 sm:p-4">
    <Link href={`/almacen-desguace/${piece.id}`} className="min-w-0 flex-1"><span className="font-mono text-xs font-black text-amber-300">{piece.codigo_interno}</span><strong className="mt-1 block truncate text-sm text-white">{piece.nombre_pieza || "Pieza sin identificar"}</strong><span className="mt-1 block truncate text-xs text-zinc-500">{piece.referencia_principal || "Sin referencia"} · {piece.estado_proceso}</span></Link>
    {action(piece)}
  </article>)}</div>;
}

function RfProblemRows({ events }: { events: WarehouseSummary["rfProblems"] }) {
  if (!events.length) return <EmptyMessage text="No hay problemas pendientes con Recambio Fácil." />;
  return <div className="divide-y divide-zinc-800">{events.map((event) => <article key={event.id} className="flex flex-wrap items-center gap-3 p-3 sm:p-4">
    <div className="min-w-0 flex-1"><span className="font-mono text-xs font-black text-amber-300">{event.pieza_codigo}</span><strong className="mt-1 block truncate text-sm text-white">{event.pieza_nombre || "Pieza sin nombre"}</strong><p className="mt-1 text-xs leading-5 text-red-300">{event.error || event.detalle || event.accion}</p><time className="mt-1 block text-[11px] text-zinc-600">{formatDate(event.created_at)}</time></div>
    {event.pieza_id && <Link href={`/almacen-desguace/${event.pieza_id}`} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-red-500/40 bg-red-500/10 px-3 text-sm font-black text-red-300 hover:bg-red-500/20">Revisar <ArrowRight size={15} /></Link>}
  </article>)}</div>;
}

function EmptyMessage({ text }: { text: string }) {
  return <div className="px-4 py-10 text-center text-sm font-semibold text-zinc-500">{text}</div>;
}
