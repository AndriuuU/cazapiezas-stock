/* eslint-disable @next/next/no-img-element */
"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowDownToLine, ArrowLeft, ArrowRight, Box, Camera, CarFront, Clock3, Edit3, Eye, Layers3, Loader2, MapPin, PackageMinus, ScanBarcode, Search, Tag, Truck, X } from "lucide-react";
import ModuleHeader from "@/components/almacen-desguace/ModuleHeader";
import DrawerLabelButton from "@/components/almacen-desguace/DrawerLabelButton";
import BarcodeScanner from "@/components/almacen-desguace/BarcodeScanner";
import RecambioFacilLink from "@/components/almacen-desguace/RecambioFacilLink";
import WarehouseLocationLink from "@/components/almacen-desguace/WarehouseLocationLink";
import type { CajonDesguace, PiezaDesguace } from "@/types/almacen-desguace";

type SearchResponse = { items: PiezaDesguace[]; error?: string };
type FreeLocation = { ubicacion: string; zona: string; estanteria_codigo: string; estanteria_nombre: string; nivel: number; hueco: number };

export default function DrawerDetail({ initialDrawer }: { initialDrawer: CajonDesguace }) {
  const [drawer, setDrawer] = useState(initialDrawer);
  const [insideQuery, setInsideQuery] = useState("");
  const [search, setSearch] = useState("");
  const [lastSearch, setLastSearch] = useState("");
  const [results, setResults] = useState<PiezaDesguace[]>([]);
  const [searching, setSearching] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [editOpen, setEditOpen] = useState(false);
  const [editError, setEditError] = useState("");
  const [savingDrawer, setSavingDrawer] = useState(false);
  const [loadingLocations, setLoadingLocations] = useState(false);
  const [freeLocations, setFreeLocations] = useState<FreeLocation[]>([]);
  const [removeTarget, setRemoveTarget] = useState<PiezaDesguace | null>(null);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [removeError, setRemoveError] = useState("");
  const [destination, setDestination] = useState("");
  const [edit, setEdit] = useState({ nombre: drawer.nombre, descripcion: drawer.descripcion || "", ubicacion: drawer.ubicacion, capacidad_maxima: String(drawer.capacidad_maxima), lleno_manual: drawer.lleno_manual, activo: drawer.activo });
  const pieces = useMemo(() => drawer.piezas || [], [drawer.piezas]);
  const visiblePieces = useMemo(() => {
    const term = insideQuery.trim().toLowerCase();
    return term ? pieces.filter((piece) => [piece.codigo_interno, piece.nombre_pieza, piece.referencia_principal, piece.referencia_oem, piece.matricula_vehiculo].join(" ").toLowerCase().includes(term)) : pieces;
  }, [insideQuery, pieces]);
  const locationGroups = useMemo(() => Object.entries(Object.groupBy(freeLocations, (location) => `${location.zona} · ${location.estanteria_codigo} · ${location.estanteria_nombre}`)), [freeLocations]);

  async function reload(message?: string) {
    const response = await fetch(`/api/almacen-desguace/cajones/${drawer.id}`);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "No se pudo actualizar el cajón.");
    setDrawer(data); setEdit({ nombre: data.nombre, descripcion: data.descripcion || "", ubicacion: data.ubicacion, capacidad_maxima: String(data.capacidad_maxima), lleno_manual: data.lleno_manual, activo: data.activo });
    if (message) setSuccess(message);
  }

  async function findPieces(scannedValue?: string) {
    const query = (scannedValue ?? search).trim();
    if (!query) return;
    if (scannedValue) setSearch(query);
    setSearching(true); setError("");
    try {
      const response = await fetch(`/api/almacen-desguace?q=${encodeURIComponent(query)}&page_size=25`);
      const data = await response.json() as SearchResponse;
      if (!response.ok) throw new Error(data.error || "No se pudieron buscar piezas.");
      setResults(data.items.filter((piece) => piece.cajon_id !== drawer.id));
      setLastSearch(query);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "No se pudieron buscar piezas."); }
    finally { setSearching(false); }
  }

  async function changePiece(piece: PiezaDesguace, action: "add" | "remove", ubicacionDestino?: string) {
    setBusyId(piece.id); setError(""); setRemoveError(""); setSuccess("");
    try {
      const response = await fetch(`/api/almacen-desguace/cajones/${drawer.id}/piezas`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, pieza_id: piece.id, ubicacion_destino: ubicacionDestino }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No se pudo mover la pieza.");
      setResults((current) => current.filter((item) => item.id !== piece.id));
      setLastSearch("");
      setRemoveTarget(null); setDestination("");
      await reload(action === "add" ? `${piece.codigo_interno} añadida al cajón.` : `${piece.codigo_interno} retirada del cajón.`);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "No se pudo mover la pieza.";
      if (action === "remove") setRemoveError(message); else setError(message);
    }
    finally { setBusyId(null); }
  }

  async function saveDrawer() {
    setSavingDrawer(true); setEditError(""); setSuccess("");
    try {
      const response = await fetch(`/api/almacen-desguace/cajones/${drawer.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(edit) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No se pudo guardar el cajón.");
      setEditOpen(false); await reload(edit.ubicacion !== drawer.ubicacion ? "Cajón y todas sus piezas trasladados." : "Cajón actualizado.");
    } catch (caught) { setEditError(caught instanceof Error ? caught.message : "No se pudo guardar el cajón."); }
    finally { setSavingDrawer(false); }
  }

  async function openEditForm() {
    setEditOpen(true); setEditError(""); setLoadingLocations(true);
    setEdit({ nombre: drawer.nombre, descripcion: drawer.descripcion || "", ubicacion: drawer.ubicacion, capacidad_maxima: String(drawer.capacidad_maxima), lleno_manual: drawer.lleno_manual, activo: drawer.activo });
    try {
      const response = await fetch("/api/almacen-desguace/ubicaciones/disponibles");
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No se pudieron cargar los huecos libres.");
      setFreeLocations(data);
    } catch (caught) { setEditError(caught instanceof Error ? caught.message : "No se pudieron cargar los huecos libres."); }
    finally { setLoadingLocations(false); }
  }

  return <main className="min-h-screen bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950">
    <ModuleHeader title={`${drawer.codigo} · ${drawer.nombre}`} subtitle="Contenido, capacidad, movimientos y etiqueta" />
    <div className="mx-auto max-w-7xl space-y-5 px-4 py-6 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3"><Link href="/almacen-desguace/cajones" className="inline-flex items-center gap-2 text-sm font-bold text-zinc-400 hover:text-white"><ArrowLeft size={17} /> Volver a los cajones</Link><div className="flex flex-wrap gap-2"><DrawerLabelButton drawer={drawer} /><button onClick={() => void openEditForm()} className="inline-flex items-center gap-2 rounded-xl bg-amber-500 px-4 py-2.5 font-black text-zinc-950"><Edit3 size={17} /> Editar o trasladar</button></div></div>
      {error && <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">{error}</div>}
      {success && <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-200">{success}</div>}
      <section className="grid gap-4 md:grid-cols-[minmax(0,1.4fr)_minmax(280px,1fr)]"><div className="min-w-0 rounded-2xl border border-zinc-800 bg-zinc-900 p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-mono text-lg font-black text-amber-300">{drawer.codigo}</p><h1 className="text-3xl font-black text-white">{drawer.nombre}</h1><p className="mt-1 text-zinc-500">{drawer.descripcion || "Sin descripción"}</p></div><span className={`rounded-full px-3 py-1 text-xs font-black ${drawer.lleno ? "bg-red-500/10 text-red-300" : "bg-emerald-500/10 text-emerald-300"}`}>{drawer.lleno ? "LLENO" : "DISPONIBLE"}</span></div><div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-zinc-950 p-4"><div className="flex min-w-0 items-center gap-3"><MapPin className="shrink-0 text-cyan-400" /><div className="min-w-0"><p className="text-xs text-zinc-500">Hueco ocupado por este cajón</p><p className="truncate font-mono font-black text-cyan-200">{drawer.ubicacion}</p></div></div><WarehouseLocationLink location={drawer.ubicacion} /></div></div><div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/5 p-5 md:col-start-2 md:row-start-1"><p className="text-sm font-bold text-cyan-200">Ocupación del cajón</p><p className="mt-2 text-4xl font-black text-white">{drawer.cantidad_piezas} <span className="text-lg text-zinc-500">/ {drawer.capacidad_maxima}</span></p><div className="mt-4 h-3 overflow-hidden rounded-full bg-zinc-800"><div className={drawer.lleno ? "h-full bg-red-500" : "h-full bg-cyan-500"} style={{ width: `${drawer.porcentaje_ocupacion}%` }} /></div><p className="mt-2 text-sm text-zinc-400">{drawer.disponibles} espacios disponibles</p></div></section>

      <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5"><div className="mb-4"><h2 className="text-xl font-black text-white">Añadir una pieza</h2><p className="text-sm text-zinc-500">Escanea su código de barras o busca por referencia, nombre, código o matrícula. Si ya está en otro cajón se trasladará.</p></div><div className="flex flex-col gap-2 sm:flex-row"><button onClick={() => setScannerOpen(true)} disabled={drawer.lleno} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-4 font-black text-cyan-300 hover:bg-cyan-500/20 disabled:opacity-40"><ScanBarcode size={20} /> Escanear código</button><label className="relative min-w-0 flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={18} /><input value={search} onChange={(e) => { setSearch(e.target.value); setLastSearch(""); }} onKeyDown={(e) => { if (e.key === "Enter") void findPieces(); }} placeholder="Ej.: 1K0959653, centralita o 1234ABC" className="w-full rounded-xl border border-zinc-700 bg-zinc-950 py-3 pl-10 pr-4 text-white outline-none focus:border-amber-500" /></label><button onClick={() => void findPieces()} disabled={searching || drawer.lleno} className="min-h-12 rounded-xl bg-amber-500 px-5 font-black text-zinc-950 disabled:opacity-40">{searching ? <Loader2 className="mx-auto animate-spin" /> : "Buscar"}</button></div>{results.length > 0 ? <div className="mt-3 divide-y divide-zinc-800 rounded-xl border border-zinc-800 bg-zinc-950">{results.map((piece) => <div key={piece.id} className="flex flex-wrap items-center justify-between gap-3 p-3"><PieceName piece={piece} /><button onClick={() => void changePiece(piece, "add")} disabled={busyId === piece.id || drawer.lleno} className="inline-flex items-center gap-2 rounded-lg bg-cyan-500 px-3 py-2 text-sm font-black text-zinc-950 disabled:opacity-40">{busyId === piece.id ? <Loader2 className="animate-spin" size={16} /> : <ArrowDownToLine size={16} />} {piece.cajon_id ? "Mover aquí" : "Añadir"}</button></div>)}</div> : lastSearch && !searching ? <div className="mt-3 rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 text-sm text-amber-200">No se encontró ninguna pieza disponible con el código <span className="font-mono font-black">{lastSearch}</span>.</div> : null}</section>

      <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5"><div className="mb-4 flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-xl font-black text-white">Piezas dentro del cajón</h2><p className="text-sm text-zinc-500">{drawer.cantidad_piezas} piezas guardadas · con fotografía y datos principales</p></div><label className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={16} /><input value={insideQuery} onChange={(e) => setInsideQuery(e.target.value)} placeholder="Referencia, nombre o matrícula..." className="rounded-xl border border-zinc-700 bg-zinc-950 py-2.5 pl-9 pr-3 text-sm text-white outline-none focus:border-cyan-500" /></label></div>{visiblePieces.length ? <div className="grid gap-3 lg:grid-cols-2">{visiblePieces.map((piece) => <DrawerPieceCard key={piece.id} piece={piece} onRemove={() => { setRemoveTarget(piece); setRemoveError(""); }} />)}</div> : <div className="py-12 text-center text-zinc-500"><Box className="mx-auto mb-2" size={40} /><p>{pieces.length ? "No hay piezas que coincidan con la búsqueda." : "Este cajón todavía no contiene piezas."}</p></div>}</section>

      <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5"><h2 className="mb-4 flex items-center gap-2 text-xl font-black text-white"><Clock3 className="text-cyan-400" /> Historial del cajón</h2><div className="space-y-3">{(drawer.movimientos || []).map((movement) => <div key={movement.id} className="flex gap-3 rounded-xl border border-zinc-800 bg-zinc-950 p-3"><span className="mt-1 h-3 w-3 shrink-0 rounded-full bg-cyan-400" /><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="font-bold capitalize text-white">{movement.tipo_movimiento}</p><span className="text-xs text-zinc-600">{new Date(movement.created_at).toLocaleString("es-ES")}</span></div><p className="text-sm text-zinc-400">{movement.detalle}</p>{movement.pieza && <Link href={`/almacen-desguace/${movement.pieza.id}`} className="text-sm font-bold text-amber-300">{movement.pieza.codigo_interno} · {movement.pieza.nombre_pieza || "Pieza"}</Link>}{movement.ubicacion_anterior && movement.ubicacion_final && <p className="mt-1 flex items-center gap-2 font-mono text-xs text-cyan-300">{movement.ubicacion_anterior}<ArrowRight size={13} />{movement.ubicacion_final}</p>}</div></div>)}</div></section>
    </div>
    {editOpen && <Modal title="Editar o trasladar el cajón" subtitle={`${drawer.codigo} · ${drawer.cantidad_piezas} piezas dentro`} onClose={() => setEditOpen(false)} wide>
      <div className="space-y-6">
        {editError && <div role="alert" className="flex gap-3 rounded-xl border border-red-400/40 bg-red-950/80 p-4 text-sm text-red-100"><AlertTriangle className="shrink-0 text-red-400" size={20} /><div><p className="font-black">No se han podido guardar los cambios</p><p className="mt-1">{editError}</p></div></div>}
        <EditSection icon={<Edit3 size={18} />} title="Datos del cajón"><div className="grid gap-4 sm:grid-cols-2"><Input label="Nombre" value={edit.nombre} onChange={(value) => setEdit({ ...edit, nombre: value })} /><Input label="Descripción" value={edit.descripcion} onChange={(value) => setEdit({ ...edit, descripcion: value })} /></div></EditSection>
        <EditSection icon={<MapPin size={18} />} title="Ubicación física"><p className="mb-3 text-sm text-zinc-500">Mantén la ubicación actual o selecciona un hueco libre. Al cambiarla se trasladarán también las {drawer.cantidad_piezas} piezas.</p>{loadingLocations ? <div className="flex items-center gap-2 rounded-xl border border-zinc-700 bg-zinc-950 p-4 text-zinc-400"><Loader2 className="animate-spin text-cyan-400" /> Buscando huecos libres...</div> : <select value={edit.ubicacion} onChange={(e) => setEdit({ ...edit, ubicacion: e.target.value })} className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-3 text-white outline-none focus:border-amber-500"><option value={drawer.ubicacion}>Ubicación actual · {drawer.ubicacion}</option>{locationGroups.map(([group, options]) => <optgroup key={group} label={group}>{options?.map((location) => <option key={location.ubicacion} value={location.ubicacion}>Nivel {location.nivel} · Hueco {location.hueco}</option>)}</optgroup>)}</select>}{edit.ubicacion !== drawer.ubicacion && <div className="mt-3 flex gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-100"><Truck className="shrink-0 text-amber-300" size={20} /><p>Se trasladará el cajón completo de <span className="font-mono font-bold">{drawer.ubicacion}</span> a <span className="font-mono font-bold">{edit.ubicacion}</span>.</p></div>}</EditSection>
        <EditSection icon={<Layers3 size={18} />} title="Capacidad y estado"><div className="grid gap-4 sm:grid-cols-2"><Input label={`Capacidad máxima · actualmente ${drawer.cantidad_piezas}`} value={edit.capacidad_maxima} type="number" onChange={(value) => setEdit({ ...edit, capacidad_maxima: value })} /><div className="space-y-2"><ToggleCard checked={edit.lleno_manual} onChange={(checked) => setEdit({ ...edit, lleno_manual: checked })} label="Marcar como lleno" description="Bloquea nuevas entradas aunque quede capacidad." /><ToggleCard checked={edit.activo} onChange={(checked) => setEdit({ ...edit, activo: checked })} label="Cajón activo" description="Permite añadir y mover piezas." /></div></div></EditSection>
        <button onClick={() => void saveDrawer()} disabled={savingDrawer || loadingLocations} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-amber-500 py-3.5 font-black text-zinc-950 hover:bg-amber-400 disabled:opacity-40">{savingDrawer ? <Loader2 className="animate-spin" size={18} /> : <Truck size={18} />} Guardar cambios</button>
      </div>
    </Modal>}
    {removeTarget && <Modal title={`Retirar ${removeTarget.codigo_interno}`} onClose={() => setRemoveTarget(null)}>{removeError && <div role="alert" className="mb-4 flex gap-3 rounded-xl border border-red-400/40 bg-red-950/80 p-4 text-sm text-red-100"><AlertTriangle className="shrink-0 text-red-400" size={20} /><p>{removeError}</p></div>}<p className="mb-4 text-sm text-zinc-400">Indica su nueva ubicación directa o déjala vacía para que quede pendiente de colocar.</p><Input label="Nueva ubicación (opcional)" value={destination} mono onChange={(value) => setDestination(value.toUpperCase())} /><button onClick={() => void changePiece(removeTarget, "remove", destination)} disabled={busyId === removeTarget.id} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-red-500 py-3 font-black text-white disabled:opacity-50">{busyId === removeTarget.id ? <Loader2 className="animate-spin" /> : <PackageMinus />} Retirar del cajón</button></Modal>}
    {scannerOpen && <BarcodeScanner onClose={() => setScannerOpen(false)} onScan={(value) => { setScannerOpen(false); void findPieces(value); }} />}
  </main>;
}

function PieceName({ piece }: { piece: PiezaDesguace }) { return <div className="min-w-0"><p className="font-mono text-sm font-black text-amber-300">{piece.referencia_principal || piece.referencia_oem || piece.codigo_interno}</p><p className="truncate font-bold text-white">{piece.nombre_pieza || "Pieza sin nombre"}</p><p className="text-xs text-zinc-500">{piece.matricula_vehiculo ? `Matrícula ${piece.matricula_vehiculo}` : piece.codigo_interno}{piece.cajon?.codigo ? ` · En ${piece.cajon.codigo}` : ""}</p></div>; }
function DrawerPieceCard({ piece, onRemove }: { piece: PiezaDesguace; onRemove: () => void }) {
  const photo = piece.fotos?.[0];
  const vehicle = [piece.marca_vehiculo, piece.modelo_vehiculo].filter(Boolean).join(" ");
  return <article className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950">
    <div className="flex gap-4 p-4">
      <Link href={`/almacen-desguace/${piece.id}`} className="group shrink-0" aria-label={`Ver ficha de ${piece.nombre_pieza || piece.codigo_interno}`}>
        {photo?.url_visualizacion ? <img src={photo.url_visualizacion} alt={piece.nombre_pieza || "Pieza almacenada"} className="h-24 w-24 rounded-xl object-cover ring-1 ring-zinc-700 transition group-hover:ring-cyan-400 sm:h-28 sm:w-28" /> : <span className="flex h-24 w-24 flex-col items-center justify-center rounded-xl border border-dashed border-zinc-700 bg-zinc-900 text-zinc-600 sm:h-28 sm:w-28"><Camera size={28} /><span className="mt-1 text-[10px]">Sin foto</span></span>}
      </Link>
      <div className="min-w-0 flex-1"><div className="flex flex-wrap items-start justify-between gap-2"><div className="min-w-0"><p className="truncate font-mono text-sm font-black text-amber-300">{piece.referencia_principal || piece.referencia_oem || "Sin referencia"}</p><h3 className="line-clamp-2 font-black text-white">{piece.nombre_pieza || "Pieza sin nombre"}</h3></div><span className={`rounded-full px-2 py-1 text-[10px] font-black ${piece.publicado_online ? "bg-emerald-500/10 text-emerald-300" : "bg-zinc-800 text-zinc-400"}`}>{piece.publicado_online ? "ONLINE" : "NO ONLINE"}</span></div>
        <div className="mt-3 space-y-1.5 text-xs"><p className="flex items-center gap-2 text-zinc-400"><CarFront className="shrink-0 text-cyan-400" size={14} /><span className="truncate">{vehicle || "Vehículo sin indicar"}{piece.matricula_vehiculo ? ` · ${piece.matricula_vehiculo}` : ""}</span></p><p className="flex items-center gap-2 text-zinc-400"><Tag className="shrink-0 text-amber-400" size={14} /><span className="truncate">{piece.categoria || "Sin categoría"} · {piece.estado_pieza || "Sin estado"}</span></p></div>
      </div>
    </div>
    <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-zinc-800 bg-zinc-900/60 px-4 py-3"><div><p className="font-mono text-[10px] text-zinc-500">{piece.codigo_interno}</p><p className="text-xs font-bold text-zinc-300">{piece.estado_proceso}{piece.precio_venta != null ? ` · ${Number(piece.precio_venta).toFixed(2)} €` : ""}</p></div><div className="flex flex-wrap gap-2"><RecambioFacilLink piece={piece} compact /><Link href={`/almacen-desguace/${piece.id}`} className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-700 px-3 py-2 text-xs font-bold text-zinc-300 hover:border-cyan-500/40 hover:text-cyan-300"><Eye size={15} /> Ver ficha</Link><button onClick={onRemove} className="inline-flex items-center gap-1.5 rounded-lg border border-red-500/30 px-3 py-2 text-xs font-bold text-red-300 hover:bg-red-500/10"><PackageMinus size={15} /> Retirar</button></div></footer>
  </article>;
}
function Modal({ title, subtitle, onClose, children, wide }: { title: string; subtitle?: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) { return <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/85 backdrop-blur-sm sm:items-center sm:p-4"><div className={`flex max-h-[96dvh] w-full flex-col overflow-hidden rounded-t-3xl border border-zinc-700 bg-zinc-900 shadow-2xl sm:rounded-3xl ${wide ? "max-w-3xl" : "max-w-lg"}`}><header className="flex shrink-0 items-start justify-between border-b border-zinc-800 px-5 py-4"><div><h2 className="text-xl font-black text-white">{title}</h2>{subtitle && <p className="mt-1 text-sm text-zinc-500">{subtitle}</p>}</div><button onClick={onClose} aria-label="Cerrar" className="rounded-xl p-2 text-zinc-400 hover:bg-zinc-800 hover:text-white"><X /></button></header><div className="min-h-0 overflow-y-auto p-5 sm:p-6">{children}</div></div></div>; }
function Input({ label, value, onChange, mono, type = "text" }: { label: string; value: string; onChange: (value: string) => void; mono?: boolean; type?: string }) { return <label className="block"><span className="mb-1.5 block text-sm text-zinc-400">{label}</span><input type={type} value={value} onChange={(e) => onChange(e.target.value)} className={`w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-white outline-none focus:border-amber-500 ${mono ? "font-mono" : ""}`} /></label>; }
function EditSection({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) { return <section><h3 className="mb-3 flex items-center gap-2 font-black text-white"><span className="rounded-lg bg-cyan-500/10 p-2 text-cyan-300">{icon}</span>{title}</h3><div className="sm:pl-10">{children}</div></section>; }
function ToggleCard({ checked, onChange, label, description }: { checked: boolean; onChange: (checked: boolean) => void; label: string; description: string }) { return <label className={`flex cursor-pointer gap-3 rounded-xl border p-3 ${checked ? "border-cyan-500/40 bg-cyan-500/10" : "border-zinc-700 bg-zinc-950"}`}><input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-1 h-4 w-4 accent-cyan-500" /><span><span className="block text-sm font-bold text-white">{label}</span><span className="block text-xs leading-5 text-zinc-500">{description}</span></span></label>; }
