"use client";

import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  AlertTriangle, Archive, Camera, CheckCircle2, CircleOff, ClipboardList,
  CloudUpload, Edit3, MapPin, PackagePlus, Search, SlidersHorizontal, Trash2,
} from "lucide-react";
import type { EventoAlmacen, TipoEventoAlmacen } from "@/types/almacen-desguace";

const EVENT_CONFIG: Record<TipoEventoAlmacen, { label: string; color: string; icon: ReactNode }> = {
  creacion_pieza: { label: "Pieza registrada", color: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300", icon: <PackagePlus size={17} /> },
  edicion_pieza: { label: "Datos modificados", color: "border-amber-500/30 bg-amber-500/10 text-amber-300", icon: <Edit3 size={17} /> },
  eliminacion_pieza: { label: "Pieza eliminada", color: "border-red-500/30 bg-red-500/10 text-red-300", icon: <Trash2 size={17} /> },
  cambio_estado: { label: "Estado cambiado", color: "border-violet-500/30 bg-violet-500/10 text-violet-300", icon: <SlidersHorizontal size={17} /> },
  cambio_proceso: { label: "Proceso cambiado", color: "border-blue-500/30 bg-blue-500/10 text-blue-300", icon: <ClipboardList size={17} /> },
  cambio_ubicacion: { label: "Ubicación cambiada", color: "border-cyan-500/30 bg-cyan-500/10 text-cyan-300", icon: <MapPin size={17} /> },
  cambio_cajon: { label: "Cajón cambiado", color: "border-cyan-500/30 bg-cyan-500/10 text-cyan-300", icon: <Archive size={17} /> },
  cambio_online: { label: "Online modificado", color: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300", icon: <CheckCircle2 size={17} /> },
  foto: { label: "Fotografía", color: "border-fuchsia-500/30 bg-fuchsia-500/10 text-fuchsia-300", icon: <Camera size={17} /> },
  publicacion_rf: { label: "Recambio Fácil", color: "border-cyan-500/30 bg-cyan-500/10 text-cyan-300", icon: <CloudUpload size={17} /> },
  online_manual: { label: "Online manual", color: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300", icon: <CheckCircle2 size={17} /> },
};

const FIELD_LABELS: Record<string, string> = {
  nombre_pieza: "Nombre",
  descripcion: "Descripción",
  categoria: "Categoría",
  marca_pieza: "Marca de la pieza",
  referencia_principal: "Referencia principal",
  referencia_oem: "Referencia OEM",
  referencias_equivalentes: "Referencias equivalentes",
  marca_vehiculo: "Marca del vehículo",
  modelo_vehiculo: "Modelo del vehículo",
  matricula_vehiculo: "Matrícula",
  motorizacion: "Motorización",
  codigo_motor: "Código de motor",
  ano_desde: "Año desde",
  ano_hasta: "Año hasta",
  estado_pieza: "Estado de la pieza",
  estado_proceso: "Proceso",
  cantidad: "Cantidad",
  precio_coste: "Precio de coste",
  precio_venta: "Precio de venta",
  ubicacion: "Ubicación",
  cajon_id: "Cajón",
  procedencia: "Procedencia",
  publicado_online: "Online",
  fecha_entrada: "Fecha de entrada",
  fecha_venta: "Fecha de venta",
  empleado: "Empleado",
  precio_final: "Precio sin IVA",
  observaciones: "Observaciones",
  fotos: "Fotografía",
};

export default function AuditHistory({ events }: { events: EventoAlmacen[] }) {
  const [query, setQuery] = useState("");
  const [type, setType] = useState("");
  const visible = useMemo(() => events.filter((event) => {
    if (type && event.tipo_evento !== type) return false;
    const term = query.trim().toLocaleLowerCase("es");
    if (!term) return true;
    return [
      event.pieza_codigo, event.pieza_nombre, event.accion, event.detalle,
      event.error, event.origen, event.usuario_nombre, ...event.campos_cambiados,
    ].filter(Boolean).join(" ").toLocaleLowerCase("es").includes(term);
  }), [events, query, type]);

  return <section className="space-y-4">
    <div className="grid gap-3 md:grid-cols-[1fr_260px]">
      <label className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={18} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar pieza, referencia, acción o error..." className="w-full rounded-xl border border-zinc-700 bg-zinc-950 py-3 pl-10 pr-4 text-white outline-none focus:border-cyan-500" /></label>
      <select value={type} onChange={(event) => setType(event.target.value)} className="rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-3 text-white outline-none focus:border-cyan-500">
        <option value="">Toda la actividad</option>
        {Object.entries(EVENT_CONFIG).map(([value, config]) => <option key={value} value={value}>{config.label}</option>)}
      </select>
    </div>

    {visible.length === 0
      ? <div className="rounded-2xl border border-dashed border-zinc-700 py-12 text-center"><ClipboardList className="mx-auto mb-3 text-zinc-700" size={40} /><p className="font-bold text-zinc-300">No hay actividad que mostrar.</p><p className="mt-1 text-sm text-zinc-500">Los nuevos cambios aparecerán aquí automáticamente.</p></div>
      : <div className="space-y-3">{visible.map((event) => <AuditEventCard key={event.id} event={event} />)}</div>}
  </section>;
}

function AuditEventCard({ event }: { event: EventoAlmacen }) {
  const config = EVENT_CONFIG[event.tipo_evento];
  const date = new Intl.DateTimeFormat("es-ES", { dateStyle: "medium", timeStyle: "short" }).format(new Date(event.created_at));
  const fields = event.campos_cambiados || [];
  const previewFields = fields.slice(0, 4);

  return <article className={`rounded-2xl border bg-zinc-900 p-4 ${event.exito ? "border-zinc-800" : "border-red-500/40"}`}>
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="flex min-w-0 items-start gap-3">
        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border ${event.exito ? config.color : "border-red-500/40 bg-red-500/10 text-red-300"}`}>{event.exito ? config.icon : <CircleOff size={17} />}</span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-black text-white">{event.accion}</h3>
            {!event.exito && <span className="rounded-full bg-red-500/10 px-2 py-0.5 text-[11px] font-black text-red-300">ERROR</span>}
          </div>
          {event.pieza_id
            ? <Link href={`/almacen-desguace/${event.pieza_id}`} className="mt-0.5 block truncate font-mono text-sm font-bold text-amber-300 hover:text-amber-200">{event.pieza_codigo} · {event.pieza_nombre || "Pieza"}</Link>
            : <p className="mt-0.5 truncate font-mono text-sm font-bold text-zinc-400">{event.pieza_codigo} · {event.pieza_nombre || "Pieza eliminada"}</p>}
        </div>
      </div>
      <div className="text-right"><span className={`rounded-full border px-2 py-1 text-[11px] font-bold ${config.color}`}>{config.label}</span><p className="mt-1 text-xs text-zinc-500">{date}</p></div>
    </div>

    {event.detalle && <p className="mt-3 text-sm text-zinc-400">{event.detalle}</p>}
    {event.error && <p className="mt-3 flex items-start gap-2 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-200"><AlertTriangle className="mt-0.5 shrink-0" size={16} /> <span className="break-words">{event.error}</span></p>}

    {previewFields.length > 0 && <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">{previewFields.map((field) => <FieldChange key={field} field={field} event={event} />)}</div>}
    {fields.length > previewFields.length && <details className="mt-3 rounded-xl border border-zinc-800 bg-zinc-950/70 p-3"><summary className="cursor-pointer text-sm font-bold text-cyan-300">Ver los {fields.length} valores anteriores y nuevos</summary><div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">{fields.map((field) => <FieldChange key={field} field={field} event={event} />)}</div></details>}

    <p className="mt-3 text-xs text-zinc-600">{event.usuario_nombre} · {event.origen}</p>
  </article>;
}

function FieldChange({ field, event }: { field: string; event: EventoAlmacen }) {
  const before = auditValue(event.valor_anterior, field, event.tipo_evento);
  const after = auditValue(event.valor_nuevo, field, event.tipo_evento);
  return <div className="min-w-0 rounded-xl bg-zinc-950 px-3 py-2">
    <p className="truncate text-[10px] font-bold uppercase tracking-wide text-zinc-500">{FIELD_LABELS[field] || field.replaceAll("_", " ")}</p>
    <div className="mt-1 flex min-w-0 items-center gap-2 text-xs"><Value value={before} empty="Vacío" /><span className="shrink-0 text-zinc-700">→</span><Value value={after} empty="Vacío" /></div>
  </div>;
}

function auditValue(snapshot: Record<string, unknown> | null, field: string, type: TipoEventoAlmacen) {
  if (!snapshot) return null;
  if (type === "foto" && field === "fotos") return snapshot.url_imagen;
  return snapshot[field];
}

function Value({ value, empty }: { value: unknown; empty: string }) {
  let text = empty;
  if (typeof value === "boolean") text = value ? "Sí" : "No";
  else if (value !== null && value !== undefined && value !== "") text = typeof value === "object" ? JSON.stringify(value) : String(value);
  return <span title={text} className="min-w-0 flex-1 truncate text-zinc-300">{text}</span>;
}
