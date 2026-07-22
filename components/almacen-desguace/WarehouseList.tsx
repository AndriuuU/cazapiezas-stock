/* eslint-disable @next/next/no-img-element */
"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  Archive, CalendarDays, Camera, CarFront, Check, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, Edit3, Eye, FilterX,
  History, Images, Loader2, MapPin, MapPinned, MoreHorizontal, PackageCheck, PackagePlus, PackageX, Plus, ScanBarcode, Search, Send, ShoppingBag,
  SlidersHorizontal, Sparkles, Tag, Warehouse, X,
} from "lucide-react";
import ModuleHeader from "@/components/almacen-desguace/ModuleHeader";
import PlacementModal from "@/components/almacen-desguace/PlacementModal";
import ConfirmDialog from "@/components/almacen-desguace/ConfirmDialog";
import BarcodeScanner from "@/components/almacen-desguace/BarcodeScanner";
import RecambioFacilLink from "@/components/almacen-desguace/RecambioFacilLink";
import WarehouseLocationLink from "@/components/almacen-desguace/WarehouseLocationLink";
import { recomendarCajon } from "@/lib/almacen-desguace-cajones-recomendacion";
import { ESTADOS_PIEZA, ESTADOS_PROCESO, type CajonDesguace, type PiezaDesguace } from "@/types/almacen-desguace";

type Action = "publicar" | "reservar" | "vender" | "enviar" | "retirar";
type ListView = "almacen" | "vendidas" | "retiradas";
type BulkField = "estado_pieza" | "estado_proceso" | "publicado_online";
type Filters = {
  q: string;
  categoria: string;
  estado_pieza: string;
  estado_proceso: string;
  publicado_online: string;
  ubicacion: string;
};
type ListResponse = {
  items: PiezaDesguace[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  categories: string[];
};
type ConfirmRequest = { title: string; description: string; confirmLabel: string; tone?: "amber" | "red"; onConfirm: () => void | Promise<void> };
type ExpandedPanel = { pieceId: number; type: "vehicle" | "actions" } | null;

const EMPTY_FILTERS: Filters = {
  q: "", categoria: "", estado_pieza: "", estado_proceso: "",
  publicado_online: "", ubicacion: "",
};

export default function WarehouseList() {
  const [pieces, setPieces] = useState<PiezaDesguace[]>([]);
  const [view, setView] = useState<ListView>("almacen");
  const [categories, setCategories] = useState<string[]>([]);
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [sort, setSort] = useState("created_at.desc");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [selectingAll, setSelectingAll] = useState(false);
  const [bulkField, setBulkField] = useState<BulkField>("estado_proceso");
  const [bulkValue, setBulkValue] = useState("");
  const [loading, setLoading] = useState(true);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [locatingPiece, setLocatingPiece] = useState<PiezaDesguace | null>(null);
  const [galleryPiece, setGalleryPiece] = useState<PiezaDesguace | null>(null);
  const [galleryLoading, setGalleryLoading] = useState(false);
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const [confirmation, setConfirmation] = useState<ConfirmRequest | null>(null);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [expandedPanel, setExpandedPanel] = useState<ExpandedPanel>(null);
  const [drawerPiece, setDrawerPiece] = useState<PiezaDesguace | null>(null);
  const [drawerOptions, setDrawerOptions] = useState<CajonDesguace[]>([]);
  const [drawerQuery, setDrawerQuery] = useState("");
  const [drawerLoading, setDrawerLoading] = useState(false);
  const [drawerSaving, setDrawerSaving] = useState<number | null>(null);
  const [drawerError, setDrawerError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams(
        Object.entries(filters).filter(([, value]) => value)
      );
      params.set("page", String(page));
      params.set("page_size", String(pageSize));
      params.set("sort", sort);
      params.set("vista", view);
      const response = await fetch(`/api/almacen-desguace?${params}`);
      const data = await response.json() as ListResponse & { error?: string };
      if (!response.ok) throw new Error(data.error || "No se pudo cargar el almacén.");
      setPieces(data.items);
      setTotal(data.total);
      setTotalPages(data.totalPages);
      setCategories(data.categories || []);
      if (page > data.totalPages) setPage(data.totalPages);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo cargar el almacén.");
    } finally {
      setLoading(false);
    }
  }, [filters, page, pageSize, sort, view]);

  useEffect(() => {
    const timer = setTimeout(() => void load(), filters.q ? 350 : 100);
    return () => clearTimeout(timer);
  }, [filters.q, load]);

  function updateFilter(field: keyof Filters, value: string) {
    setFilters((current) => ({ ...current, [field]: value }));
    setPage(1);
    setSelected(new Set());
    setSuccess("");
  }

  function clearFilters() {
    setFilters(EMPTY_FILTERS);
    setPage(1);
    setSelected(new Set());
    setSuccess("");
  }

  function changeView(nextView: ListView) {
    setView(nextView);
    setFilters((current) => ({ ...current, estado_proceso: "", ubicacion: "" }));
    setPage(1);
    setSelected(new Set());
    setExpandedPanel(null);
    setSuccess("");
  }

  async function executeAction(piece: PiezaDesguace, action: Action) {
    setError("");
    setSuccess("");
    const response = await fetch(`/api/almacen-desguace/${piece.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }),
    });
    const data = await response.json();
    if (!response.ok) setError(data.error);
    else { setSuccess(`${piece.codigo_interno} actualizado.`); void load(); }
  }

  function act(piece: PiezaDesguace, action: Action) {
    if (action === "vender" || action === "retirar") {
      const retiring = action === "retirar";
      setConfirmation({
        title: retiring ? "¿Retirar esta pieza?" : "¿Marcar la pieza como vendida?",
        description: retiring
          ? `${piece.codigo_interno} saldrá de Piezas almacenadas, aparecerá en Retiradas y dejará libre su ubicación${piece.cajon_id ? " y su espacio en el cajón" : ""}.`
          : `${piece.codigo_interno} saldrá de Piezas almacenadas, aparecerá en Vendidas, dejará libre su ubicación${piece.cajon_id ? " y su espacio en el cajón" : ""}, y dejará de estar online.`,
        confirmLabel: retiring ? "Sí, retirar" : "Sí, marcar vendida",
        tone: "red",
        onConfirm: () => executeAction(piece, action),
      });
      return;
    }
    void executeAction(piece, action);
  }

  async function openGallery(piece: PiezaDesguace) {
    setGalleryPiece(piece);
    setGalleryLoading(true);
    try {
      const response = await fetch(`/api/almacen-desguace/${piece.id}`);
      const data = await response.json() as PiezaDesguace & { error?: string };
      if (!response.ok) throw new Error(data.error || "No se pudieron cargar las fotografías.");
      setGalleryPiece(data);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudieron cargar las fotografías.");
    } finally {
      setGalleryLoading(false);
    }
  }

  async function openDrawerPicker(piece: PiezaDesguace) {
    setDrawerPiece(piece); setDrawerLoading(true); setDrawerError(""); setDrawerQuery("");
    try {
      const response = await fetch("/api/almacen-desguace/cajones");
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No se pudieron cargar los cajones.");
      setDrawerOptions((data as CajonDesguace[]).filter((drawer) => drawer.activo && (!drawer.lleno || drawer.id === piece.cajon_id)));
    } catch (caught) { setDrawerError(caught instanceof Error ? caught.message : "No se pudieron cargar los cajones."); }
    finally { setDrawerLoading(false); }
  }

  async function assignDrawer(drawer: CajonDesguace) {
    if (!drawerPiece || drawer.id === drawerPiece.cajon_id) return;
    setDrawerSaving(drawer.id); setDrawerError("");
    try {
      const response = await fetch(`/api/almacen-desguace/cajones/${drawer.id}/piezas`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "add", pieza_id: drawerPiece.id }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No se pudo guardar la pieza en el cajón.");
      const message = drawerPiece.cajon_id ? `${drawerPiece.codigo_interno} trasladada a ${drawer.codigo}.` : `${drawerPiece.codigo_interno} guardada en ${drawer.codigo}.`;
      setDrawerPiece(null); setSuccess(message); setExpandedPanel(null); await load();
    } catch (caught) { setDrawerError(caught instanceof Error ? caught.message : "No se pudo guardar la pieza en el cajón."); }
    finally { setDrawerSaving(null); }
  }

  function togglePiece(id: number) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  const pageIds = useMemo(() => pieces.map((piece) => piece.id), [pieces]);
  const allPageSelected = pageIds.length > 0 && pageIds.every((id) => selected.has(id));
  function togglePage() {
    setSelected((current) => {
      const next = new Set(current);
      if (allPageSelected) pageIds.forEach((id) => next.delete(id));
      else pageIds.forEach((id) => next.add(id));
      return next;
    });
  }

  async function selectAllResults() {
    if (selected.size === total) {
      setSelected(new Set());
      return;
    }
    setSelectingAll(true); setError(""); setSuccess("");
    try {
      const params = new URLSearchParams(Object.entries(filters).filter(([, value]) => value));
      params.set("vista", view);
      params.set("all_ids", "true");
      const response = await fetch(`/api/almacen-desguace?${params}`);
      const data = await response.json() as { ids?: number[]; total?: number; error?: string };
      if (!response.ok) throw new Error(data.error || "No se pudieron seleccionar todas las piezas.");
      if ((data.total || 0) > (data.ids?.length || 0)) throw new Error("Hay más de 1.000 resultados. Aplica algún filtro antes de seleccionarlos todos.");
      setSelected(new Set(data.ids || []));
      setSuccess(`${(data.ids || []).length} piezas seleccionadas.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudieron seleccionar todas las piezas.");
    } finally {
      setSelectingAll(false);
    }
  }

  function togglePanel(pieceId: number, type: "vehicle" | "actions") {
    setExpandedPanel((current) => current?.pieceId === pieceId && current.type === type ? null : { pieceId, type });
  }

  function applyBulkChange() {
    if (!selected.size || !bulkValue) {
      setError("Selecciona piezas y el valor que quieres aplicar.");
      return;
    }
    const value = bulkField === "publicado_online" ? bulkValue === "true" : bulkValue;
    const selectedCount = selected.size;
    setConfirmation({
      title: `¿Modificar ${selectedCount} piezas?`,
      description: `Se aplicará el nuevo valor a todas las piezas seleccionadas. Esta acción puede tardar unos segundos.`,
      confirmLabel: `Aplicar a ${selectedCount}`,
      onConfirm: () => performBulkChange(value),
    });
  }

  async function performBulkChange(value: string | boolean) {
    setBulkLoading(true);
    setError("");
    setSuccess("");
    try {
      const response = await fetch("/api/almacen-desguace/bulk", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [...selected], changes: { [bulkField]: value } }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No se pudo aplicar el cambio.");
      setSuccess(`${data.count} piezas actualizadas correctamente.`);
      setSelected(new Set());
      setBulkValue("");
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo aplicar el cambio.");
    } finally {
      setBulkLoading(false);
    }
  }

  const activeFilterCount = Object.values(filters).filter(Boolean).length;
  const firstResult = total ? (page - 1) * pageSize + 1 : 0;
  const lastResult = Math.min(page * pageSize, total);

  return (
    <main className="min-h-screen bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950">
      <ModuleHeader />
      <div className="mx-auto max-w-[1500px] space-y-5 px-4 py-6 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-black text-white">{view === "almacen" ? "Piezas almacenadas" : view === "vendidas" ? "Piezas vendidas" : "Piezas retiradas"}</h1>
            <p className="text-sm text-zinc-500">{total.toLocaleString("es-ES")} {view === "almacen" ? "piezas disponibles en Almacén Desguace" : view === "vendidas" ? "piezas vendidas y fuera del almacenamiento" : "piezas retiradas del almacén"}.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/almacen-desguace/cajones" className="inline-flex items-center gap-2 rounded-xl border border-cyan-500/30 bg-cyan-500/5 px-4 py-2.5 font-bold text-cyan-200 hover:bg-cyan-500/10">
              <Archive size={18} /> Cajones
            </Link>
            <Link href="/almacen-desguace/plano" className="inline-flex items-center gap-2 rounded-xl border border-cyan-500/30 bg-cyan-500/5 px-4 py-2.5 font-bold text-cyan-200 hover:bg-cyan-500/10">
              <MapPinned size={18} /> Plano general
            </Link>
            <Link href="/almacen-desguace/historial" className="inline-flex items-center gap-2 rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-2.5 font-bold text-zinc-200 hover:border-cyan-500/50 hover:text-cyan-300">
              <History size={18} /> Historial
            </Link>
            <Link href="/almacen-desguace/estanterias" className="inline-flex items-center gap-2 rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-2.5 font-bold text-zinc-200 hover:border-cyan-500/50 hover:text-cyan-300">
              <Warehouse size={18} /> Organizar estanterías
            </Link>
            <Link href="/almacen-desguace/nueva" className="inline-flex items-center gap-2 rounded-xl bg-amber-500 px-4 py-2.5 font-bold text-zinc-950 hover:bg-amber-400">
              <Plus size={18} /> Nueva pieza
            </Link>
          </div>
        </div>

        <nav className="grid gap-2 rounded-2xl border border-zinc-800 bg-zinc-900 p-2 sm:grid-cols-3" aria-label="Listados de piezas">
          <button onClick={() => changeView("almacen")} className={`flex items-center justify-center gap-2 rounded-xl px-4 py-3 font-black transition ${view === "almacen" ? "bg-amber-500 text-zinc-950" : "text-zinc-400 hover:bg-zinc-800 hover:text-white"}`}><Warehouse size={18} /> Almacenadas</button>
          <button onClick={() => changeView("vendidas")} className={`flex items-center justify-center gap-2 rounded-xl px-4 py-3 font-black transition ${view === "vendidas" ? "bg-emerald-500 text-zinc-950" : "text-zinc-400 hover:bg-zinc-800 hover:text-white"}`}><ShoppingBag size={18} /> Vendidas</button>
          <button onClick={() => changeView("retiradas")} className={`flex items-center justify-center gap-2 rounded-xl px-4 py-3 font-black transition ${view === "retiradas" ? "bg-red-500 text-white" : "text-zinc-400 hover:bg-zinc-800 hover:text-white"}`}><PackageX size={18} /> Retiradas</button>
        </nav>

        <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-semibold text-zinc-300">Buscar y filtrar</p>
            <button onClick={clearFilters} disabled={!activeFilterCount} className="inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-white disabled:opacity-30">
              <FilterX size={16} /> Limpiar filtros {activeFilterCount ? `(${activeFilterCount})` : ""}
            </button>
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-8">
            <label className="relative md:col-span-2 xl:col-span-3">
              <Search className="absolute left-3 top-3 text-zinc-500" size={18} />
              <input value={filters.q} onChange={(event) => updateFilter("q", event.target.value)} placeholder="Código, nombre, referencia, marca, modelo, motor..." className="w-full rounded-xl border border-zinc-700 bg-zinc-950 py-2.5 pl-10 pr-10 text-white focus:border-amber-500 focus:outline-none" />
              {filters.q && <button onClick={() => updateFilter("q", "")} title="Borrar búsqueda" className="absolute right-3 top-2.5 rounded p-1 text-zinc-500 hover:text-white"><X size={17} /></button>}
            </label>
            <button onClick={() => setScannerOpen(true)} className="inline-flex items-center justify-center gap-2 rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-3 py-2.5 font-bold text-cyan-300 hover:bg-cyan-500/20"><ScanBarcode size={18} /> Escanear</button>
            <button onClick={() => setShowMobileFilters((current) => !current)} className="inline-flex items-center justify-center gap-2 rounded-xl border border-zinc-700 py-2.5 text-sm font-semibold text-zinc-300 md:hidden"><SlidersHorizontal size={17} /> {showMobileFilters ? "Ocultar filtros" : "Más filtros"}</button>
            <div className={showMobileFilters ? "contents" : "hidden md:contents"}>
              <FilterSelect value={filters.categoria} onChange={(value) => updateFilter("categoria", value)}><option value="">Todas las categorías</option>{categories.map((value) => <option key={value}>{value}</option>)}</FilterSelect>
              <FilterSelect value={filters.estado_pieza} onChange={(value) => updateFilter("estado_pieza", value)}><option value="">Cualquier estado</option>{ESTADOS_PIEZA.map((value) => <option key={value}>{value}</option>)}</FilterSelect>
              {view === "almacen" ? <FilterSelect value={filters.estado_proceso} onChange={(value) => updateFilter("estado_proceso", value)}><option value="">Cualquier proceso</option>{ESTADOS_PROCESO.filter((value) => value !== "Retirada" && value !== "Vendida").map((value) => <option key={value}>{value}</option>)}</FilterSelect> : view === "vendidas" ? <div className="flex items-center rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-3 py-2.5 text-sm font-bold text-emerald-300">Proceso: Vendida</div> : <div className="flex items-center rounded-xl border border-red-500/20 bg-red-500/5 px-3 py-2.5 text-sm font-bold text-red-300">Proceso: Retirada</div>}
              <FilterSelect value={filters.publicado_online} onChange={(value) => updateFilter("publicado_online", value)}><option value="">Online y no online</option><option value="true">Publicadas online</option><option value="false">No publicadas</option></FilterSelect>
              <label className="relative md:col-span-2 xl:col-span-2"><MapPin className="absolute left-3 top-3 text-zinc-500" size={18} /><input value={filters.ubicacion} onChange={(event) => updateFilter("ubicacion", event.target.value.toUpperCase())} placeholder="Ubicación: E01, DESGUACE-E01..." className="w-full rounded-xl border border-zinc-700 bg-zinc-950 py-2.5 pl-10 pr-3 font-mono text-white focus:border-amber-500 focus:outline-none" /></label>
              <FilterSelect value={sort} onChange={(value) => { setSort(value); setPage(1); }}><option value="created_at.desc">Más recientes primero</option><option value="created_at.asc">Más antiguas primero</option><option value="nombre.asc">Nombre A–Z</option><option value="referencia.asc">Referencia A–Z</option><option value="ubicacion.asc">Ubicación</option><option value="precio.desc">Mayor precio</option><option value="precio.asc">Menor precio</option></FilterSelect>
            </div>
          </div>
          <p className="mt-3 text-xs text-zinc-500">Puedes escribir varias palabras: todas deberán aparecer en alguno de los campos buscables.</p>
        </section>

        {selected.size > 0 && (
          <section className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-end">
              <div className="min-w-48">
                <p className="font-bold text-amber-200">{selected.size.toLocaleString("es-ES")} {selected.size === total && total > 0 ? "piezas seleccionadas · selección completa" : "piezas seleccionadas"}</p>
                <button onClick={() => setSelected(new Set())} className="text-xs text-amber-300/70 hover:text-amber-200">Cancelar selección</button>
              </div>
              <FieldLabel label="Dato que quieres modificar">
                <select value={bulkField} onChange={(event) => { setBulkField(event.target.value as BulkField); setBulkValue(""); }} className="bulk-input">
                  <option value="estado_pieza">Estado de la pieza</option><option value="estado_proceso">Estado del proceso</option><option value="publicado_online">Publicación online</option>
                </select>
              </FieldLabel>
              <FieldLabel label="Nuevo valor"><BulkValue field={bulkField} value={bulkValue} onChange={setBulkValue} /></FieldLabel>
              <button onClick={() => void applyBulkChange()} disabled={bulkLoading || !bulkValue} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-amber-500 px-5 py-2.5 font-bold text-zinc-950 hover:bg-amber-400 disabled:opacity-50">
                {bulkLoading ? <Loader2 className="animate-spin" size={17} /> : <SlidersHorizontal size={17} />} Aplicar a {selected.size}
              </button>
            </div>
          </section>
        )}

        {error && <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">{error}</div>}
        {success && <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-300">{success}</div>}

        <section className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800 px-4 py-3 text-sm text-zinc-400">
            <span className="flex flex-wrap items-center gap-3"><span className="lg:hidden"><PrettyCheckbox checked={allPageSelected} onChange={togglePage} label="Seleccionar esta página" /></span><span>Mostrando {firstResult}–{lastResult} de {total.toLocaleString("es-ES")}</span><button onClick={() => void selectAllResults()} disabled={selectingAll || !total} className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/5 px-2.5 py-1.5 text-xs font-black text-amber-300 hover:bg-amber-500/10 disabled:opacity-40">{selectingAll ? <Loader2 className="animate-spin" size={14} /> : <Check size={14} />}{selected.size === total && total > 0 ? "Quitar selección completa" : `Seleccionar las ${total.toLocaleString("es-ES")}`}</button></span>
            <label className="flex items-center gap-2">Filas por página<select aria-label="Filas por página" value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value)); setPage(1); setSelected(new Set()); }} className="rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-1 text-white"><option value="10">10</option><option value="25">25</option><option value="50">50</option><option value="100">100</option></select></label>
          </div>
          {loading ? (
            <div className="flex items-center justify-center gap-3 py-16 text-zinc-400"><Loader2 className="animate-spin text-amber-400" /> Cargando piezas...</div>
          ) : pieces.length === 0 ? (
            <div className="py-16 text-center"><Warehouse className="mx-auto mb-3 text-zinc-700" size={44} /><p className="font-semibold text-zinc-300">No hay piezas con estos filtros.</p><button onClick={clearFilters} className="mt-3 text-sm text-amber-400 hover:text-amber-300">Quitar filtros</button></div>
          ) : <>
            <div className="divide-y divide-zinc-800 lg:hidden">
              {pieces.map((piece) => <PieceCard key={piece.id} piece={piece} selected={selected.has(piece.id)} expanded={expandedPanel?.pieceId === piece.id ? expandedPanel.type : null} onToggle={() => togglePiece(piece.id)} onPanel={(type) => togglePanel(piece.id, type)} onLocate={() => setLocatingPiece(piece)} onDrawer={() => void openDrawerPicker(piece)} onPhotos={() => void openGallery(piece)} onAction={(action) => void act(piece, action)} />)}
            </div>
            <div className="hidden overflow-x-auto lg:block">
              <table className="w-full min-w-[1120px] text-left text-xs">
                <thead className="bg-zinc-950 uppercase tracking-wide text-zinc-500"><tr><th className="px-3 py-2"><PrettyCheckbox checked={allPageSelected} onChange={togglePage} label="Seleccionar esta página" /></th>{["Fotos", "Referencia", "Coche", "Precio", "Fecha", "Ubicación", "Estados", "Online", "Acciones"].map((value) => <th key={value} className="px-2 py-2">{value}</th>)}</tr></thead>
                <tbody className="divide-y divide-zinc-800">{pieces.map((piece) => <PieceRow key={piece.id} piece={piece} selected={selected.has(piece.id)} expanded={expandedPanel?.pieceId === piece.id ? expandedPanel.type : null} onToggle={() => togglePiece(piece.id)} onPanel={(type) => togglePanel(piece.id, type)} onLocate={() => setLocatingPiece(piece)} onDrawer={() => void openDrawerPicker(piece)} onPhotos={() => void openGallery(piece)} onAction={(action) => void act(piece, action)} />)}</tbody>
              </table>
            </div>
          </>}
          <Pagination page={page} totalPages={totalPages} onPage={setPage} />
        </section>
      </div>
      {locatingPiece && <PlacementModal piece={locatingPiece} onClose={() => setLocatingPiece(null)} onPlaced={(message) => { setSuccess(message); setLocatingPiece(null); void load(); }} />}
      {galleryPiece && <PhotoGalleryModal key={galleryPiece.id} piece={galleryPiece} loading={galleryLoading} onClose={() => setGalleryPiece(null)} />}
      {drawerPiece && <DrawerPickerModal piece={drawerPiece} drawers={drawerOptions} query={drawerQuery} loading={drawerLoading} savingId={drawerSaving} error={drawerError} onQuery={setDrawerQuery} onSelect={(drawer) => void assignDrawer(drawer)} onClose={() => setDrawerPiece(null)} />}
      {confirmation && <ConfirmDialog title={confirmation.title} description={confirmation.description} confirmLabel={confirmation.confirmLabel} tone={confirmation.tone} onConfirm={confirmation.onConfirm} onClose={() => setConfirmation(null)} />}
      {scannerOpen && <BarcodeScanner onClose={() => setScannerOpen(false)} onScan={(value) => { updateFilter("q", value); setScannerOpen(false); setSuccess(`Código leído: ${value}`); }} />}
      <style jsx global>{`.bulk-input { min-height: 42px; width: 100%; border-radius: 0.75rem; border: 1px solid rgb(113 113 122); background: rgb(9 9 11); padding: 0.5rem 0.75rem; color: white; outline: none; } .bulk-input:focus { border-color: rgb(245 158 11); }`}</style>
    </main>
  );
}

type PieceItemProps = { piece: PiezaDesguace; selected: boolean; expanded: "vehicle" | "actions" | null; onToggle: () => void; onPanel: (type: "vehicle" | "actions") => void; onLocate: () => void; onDrawer: () => void; onPhotos: () => void; onAction: (action: Action) => void };

function PieceRow({ piece, selected, expanded, onToggle, onPanel, onLocate, onDrawer, onPhotos, onAction }: PieceItemProps) {
  const photo = piece.fotos?.[0];
  return <>
    <tr className={`hover:bg-zinc-800/40 ${selected ? "bg-amber-500/5" : ""}`}>
      <td className="px-3 py-1.5"><PrettyCheckbox checked={selected} onChange={onToggle} label={`Seleccionar ${piece.codigo_interno}`} /></td>
      <td className="px-2 py-1.5"><button onClick={onPhotos} title="Ver fotografías" className="group relative block">{photo?.url_visualizacion ? <img src={photo.url_visualizacion} alt="" className="h-9 w-9 rounded-md object-cover ring-1 ring-zinc-700 group-hover:ring-cyan-400" /> : <span className="flex h-9 w-9 items-center justify-center rounded-md bg-zinc-800 text-zinc-600"><Camera size={16} /></span>}<Images className="absolute -bottom-1 -right-1 rounded bg-cyan-500 p-0.5 text-zinc-950" size={14} /></button></td>
      <td className="max-w-52 px-2 py-1.5"><Link href={`/almacen-desguace/${piece.id}`} title="Abrir ficha de la pieza" className="block truncate font-mono text-sm font-bold text-amber-300 underline decoration-amber-500/30 underline-offset-2 transition hover:text-amber-200 hover:decoration-amber-300">{piece.referencia_principal || piece.referencia_oem || "Sin referencia"}</Link><p className="truncate text-[11px] text-zinc-500">{piece.nombre_pieza || piece.codigo_interno}</p></td>
      <td className="px-2 py-1.5"><CompactToggle active={expanded === "vehicle"} onClick={() => onPanel("vehicle")} icon={<CarFront size={15} />} label="Ver coche" /></td>
      <td className="px-2 py-1.5 text-sm font-bold text-emerald-300">{piece.precio_venta == null ? "-" : `${Number(piece.precio_venta).toFixed(2)} €`}</td>
      <td className="px-2 py-1.5 text-zinc-400">{formatDate(piece.fecha_entrada)}</td>
      <td className="px-2 py-1.5"><WarehouseLocationLink location={piece.ubicacion} compact /></td>
      <td className="max-w-48 px-2 py-1.5"><p className="truncate text-[11px] text-zinc-300">{piece.estado_pieza || "Sin estado"}</p><p className="truncate text-[11px] text-zinc-500">{piece.estado_proceso}</p></td>
      <td className="px-2 py-1.5"><div className="flex flex-col items-start gap-1"><OnlineBadge online={piece.publicado_online} /><RecambioFacilLink piece={piece} compact /></div></td>
      <td className="px-2 py-1.5"><CompactToggle active={expanded === "actions"} onClick={() => onPanel("actions")} icon={<MoreHorizontal size={16} />} label="Acciones" /></td>
    </tr>
    {expanded && <tr className="bg-zinc-950/70"><td colSpan={10} className="px-4 py-3">{expanded === "vehicle" ? <VehicleDetails piece={piece} /> : <ActionPanel piece={piece} onLocate={onLocate} onDrawer={onDrawer} onPhotos={onPhotos} onAction={onAction} />}</td></tr>}
  </>;
}

function PieceCard({ piece, selected, expanded, onToggle, onPanel, onLocate, onDrawer, onPhotos, onAction }: PieceItemProps) {
  const photo = piece.fotos?.[0];
  return <article className={`p-4 ${selected ? "bg-amber-500/5" : ""}`}>
    <div className="flex items-start gap-3">
      <div className="pt-2"><PrettyCheckbox checked={selected} onChange={onToggle} label={`Seleccionar ${piece.codigo_interno}`} /></div>
      <button onClick={onPhotos} className="relative block shrink-0 overflow-hidden rounded-xl bg-zinc-800 ring-1 ring-zinc-700" style={{ width: 64, minWidth: 64, maxWidth: 64, height: 64, minHeight: 64, maxHeight: 64 }} title="Ver fotografías">{photo?.url_visualizacion ? <img src={photo.url_visualizacion} alt="" width={64} height={64} className="block object-cover" style={{ width: 64, minWidth: 64, maxWidth: 64, height: 64, minHeight: 64, maxHeight: 64, objectFit: "cover" }} /> : <span className="flex h-full w-full items-center justify-center text-zinc-600"><Camera size={22} /></span>}<span className="absolute bottom-1 right-1 flex h-5 w-5 items-center justify-center rounded-full bg-cyan-500 text-zinc-950"><Images size={13} /></span></button>
      <div className="min-w-0 flex-1">
        <Link href={`/almacen-desguace/${piece.id}`} title="Abrir ficha de la pieza" className="block truncate font-mono text-lg font-black text-amber-300 underline decoration-amber-500/30 underline-offset-4 hover:text-amber-200">{piece.referencia_principal || piece.referencia_oem || "Sin referencia"}</Link>
        <p className="mt-0.5 line-clamp-2 text-sm font-semibold leading-5 text-zinc-300">{piece.nombre_pieza || piece.codigo_interno}</p>
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm"><span className="font-black text-emerald-300">{piece.precio_venta == null ? "Sin precio" : `${Number(piece.precio_venta).toFixed(2)} €`}</span><span className="flex items-center gap-1.5 text-zinc-400"><CalendarDays size={15} />{formatDate(piece.fecha_entrada)}</span></div>
      </div>
    </div>
    <div className="mt-3 flex flex-wrap items-center gap-2"><OnlineBadge online={piece.publicado_online} large /><RecambioFacilLink piece={piece} /></div>
    <div className="mt-3 rounded-xl border border-cyan-500/15 bg-zinc-950/70 p-3">
      <p className="mb-2 text-sm font-black text-cyan-300">Ubicación en el almacén</p>
      {piece.ubicacion ? <WarehouseLocationLink location={piece.ubicacion} prominent /> : <button onClick={onLocate} className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm font-black text-amber-200"><MapPin size={18} /> Sin ubicar · asignar ubicación</button>}
    </div>
    <div className="mt-3 grid gap-3 rounded-xl bg-zinc-950/60 p-3 sm:grid-cols-2"><div><span className="block text-xs font-semibold text-zinc-500">Estado de la pieza</span><p className="mt-1 text-sm font-semibold leading-5 text-zinc-200">{piece.estado_pieza || "Sin estado"}</p></div><div><span className="block text-xs font-semibold text-zinc-500">Proceso</span><p className="mt-1 text-sm font-semibold leading-5 text-zinc-300">{piece.estado_proceso}</p></div></div>
    <div className="mt-3 flex gap-2"><CompactToggle wide active={expanded === "vehicle"} onClick={() => onPanel("vehicle")} icon={<CarFront size={17} />} label="Ver coche" /><CompactToggle wide active={expanded === "actions"} onClick={() => onPanel("actions")} icon={<MoreHorizontal size={18} />} label="Acciones" /></div>
    {expanded && <div className="mt-3 rounded-xl border border-zinc-800 bg-zinc-950 p-4">{expanded === "vehicle" ? <VehicleDetails piece={piece} /> : <ActionPanel piece={piece} onLocate={onLocate} onDrawer={onDrawer} onPhotos={onPhotos} onAction={onAction} />}</div>}
  </article>;
}

function CompactToggle({ active, onClick, icon, label, wide = false }: { active: boolean; onClick: () => void; icon: ReactNode; label: string; wide?: boolean }) {
  return <button onClick={onClick} className={`inline-flex items-center justify-center gap-1.5 rounded-lg border font-semibold ${wide ? "min-h-11 flex-1 px-4 py-2.5 text-sm" : "min-h-8 px-2.5 py-1.5 text-xs"} ${active ? "border-amber-500/50 bg-amber-500/10 text-amber-300" : "border-zinc-700 text-zinc-400 hover:bg-zinc-800 hover:text-white"}`}>{icon}{label}<ChevronDown size={wide ? 15 : 13} className={active ? "rotate-180" : ""} /></button>;
}

function VehicleDetails({ piece }: { piece: PiezaDesguace }) {
  return <div><p className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-cyan-300"><CarFront size={16} /> Vehículo compatible</p><div className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-5"><DetailItem label="Marca" value={piece.marca_vehiculo} /><DetailItem label="Modelo" value={piece.modelo_vehiculo} /><DetailItem label="Motorización" value={piece.motorizacion} /><DetailItem label="Código motor" value={piece.codigo_motor} /><DetailItem label="Años" value={[piece.ano_desde, piece.ano_hasta].filter(Boolean).join("–") || null} /></div></div>;
}

function ActionPanel({ piece, onLocate, onDrawer, onPhotos, onAction }: { piece: PiezaDesguace; onLocate: () => void; onDrawer: () => void; onPhotos: () => void; onAction: (action: Action) => void }) {
  const retired = piece.estado_proceso === "Retirada";
  const sold = piece.estado_proceso === "Vendida";
  const outsideStorage = retired || sold;
  return <div><div className="mb-2 flex items-center justify-between"><p className="text-xs font-bold uppercase tracking-wide text-amber-300">Acciones de la pieza</p><span className="font-mono text-[10px] text-zinc-600">{piece.codigo_interno}</span></div><div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5"><ActionLink href={`/almacen-desguace/${piece.id}`} icon={<Eye />} label="Ver ficha" /><ActionLink href={`/almacen-desguace/${piece.id}/editar`} icon={<Edit3 />} label={outsideStorage ? "Editar o recuperar" : "Editar"} /><ActionButton onClick={onPhotos} icon={<Images />} label="Ver fotos" />{!outsideStorage && <><ActionButton onClick={onLocate} icon={<MapPin />} label="Ubicar" /><ActionButton onClick={onDrawer} icon={<PackagePlus />} label={piece.cajon_id ? "Cambiar cajón" : "Guardar en cajón"} /><ActionLink href={`/almacen-desguace/${piece.id}#fotografias`} icon={<Camera />} label="Subir fotos" /><ActionButton onClick={() => onAction("publicar")} icon={<Tag />} label="Publicar" /><ActionButton onClick={() => onAction("reservar")} icon={<PackageCheck />} label="Reservar" /><ActionButton onClick={() => onAction("vender")} icon={<ShoppingBag />} label="Vendida" /><ActionButton onClick={() => onAction("enviar")} icon={<Send />} label="Enviada" /><ActionButton danger onClick={() => onAction("retirar")} icon={<PackageX />} label="Retirar" /></>}</div>{outsideStorage && <p className={`mt-3 rounded-lg border px-3 py-2 text-xs ${sold ? "border-emerald-500/20 bg-emerald-500/5 text-emerald-200" : "border-red-500/20 bg-red-500/5 text-red-200"}`}>{sold ? "Esta pieza está vendida, fuera del almacenamiento y no ocupa ningún hueco. Puedes recuperarla cambiando su proceso desde Editar." : "Esta pieza está retirada y no ocupa ninguna ubicación. Puedes recuperarla cambiando su proceso desde Editar."}</p>}</div>;
}

function DrawerPickerModal({ piece, drawers, query, loading, savingId, error, onQuery, onSelect, onClose }: { piece: PiezaDesguace; drawers: CajonDesguace[]; query: string; loading: boolean; savingId: number | null; error: string; onQuery: (value: string) => void; onSelect: (drawer: CajonDesguace) => void; onClose: () => void }) {
  const term = query.trim().toLowerCase();
  const visible = term ? drawers.filter((drawer) => [drawer.codigo, drawer.nombre, drawer.descripcion, drawer.ubicacion].join(" ").toLowerCase().includes(term)) : drawers;
  const recommendation = recomendarCajon(piece, drawers);
  const showRecommendation = !term && recommendation;
  const listedDrawers = showRecommendation ? visible.filter((drawer) => drawer.id !== recommendation.cajon.id) : visible;
  return <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/85 backdrop-blur-sm sm:items-center sm:p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <div role="dialog" aria-modal="true" aria-label={`Guardar ${piece.codigo_interno} en un cajón`} className="flex max-h-[94dvh] w-full max-w-3xl flex-col overflow-hidden rounded-t-3xl border border-zinc-700 bg-zinc-900 shadow-2xl sm:rounded-3xl">
      <header className="flex shrink-0 items-start justify-between gap-3 border-b border-zinc-800 px-5 py-4 sm:px-6"><div className="flex gap-3"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-cyan-500 text-zinc-950"><PackagePlus size={22} /></span><div><h2 className="text-xl font-black text-white">{piece.cajon_id ? "Cambiar de cajón" : "Guardar en un cajón"}</h2><p className="mt-0.5 text-sm text-zinc-400"><span className="font-mono font-bold text-amber-300">{piece.referencia_principal || piece.codigo_interno}</span> · {piece.nombre_pieza || "Pieza sin nombre"}</p></div></div><button onClick={onClose} aria-label="Cerrar" className="rounded-xl p-2 text-zinc-400 hover:bg-zinc-800 hover:text-white"><X /></button></header>
      <div className="min-h-0 flex-1 overflow-y-auto p-5 sm:p-6">
        {piece.cajon && <div className="mb-4 flex items-center gap-3 rounded-xl border border-amber-500/20 bg-amber-500/5 p-4"><Archive className="text-amber-300" /><div><p className="text-xs text-zinc-500">Cajón actual</p><p className="font-bold text-white">{piece.cajon.codigo} · {piece.cajon.nombre}</p><p className="font-mono text-xs text-zinc-500">{piece.cajon.ubicacion}</p></div></div>}
        {error && <div role="alert" className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">{error}</div>}
        {showRecommendation && <section className="mb-4 overflow-hidden rounded-2xl border border-emerald-500/30 bg-emerald-500/10"><div className="flex items-center gap-2 border-b border-emerald-500/20 px-4 py-3 text-emerald-200"><Sparkles size={18} /><p className="text-sm font-black uppercase tracking-wide">Cajón recomendado</p></div><div className="grid gap-4 p-4 sm:grid-cols-[1fr_auto] sm:items-center"><div><div className="flex flex-wrap items-center gap-2"><span className="font-mono text-sm font-black text-amber-300">{recommendation.cajon.codigo}</span><span className="rounded-full bg-black/20 px-2 py-1 text-[10px] font-bold text-emerald-200">{recommendation.cajon.cantidad_piezas}/{recommendation.cajon.capacidad_maxima}</span></div><h3 className="text-lg font-black text-white">{recommendation.cajon.nombre}</h3><p className="mt-1 font-mono text-xs text-cyan-300">{recommendation.cajon.ubicacion}</p><div className="mt-3 flex flex-wrap gap-1.5">{recommendation.motivos.map((reason) => <span key={reason} className="rounded-lg border border-emerald-500/20 bg-black/15 px-2 py-1 text-xs text-emerald-100">{reason}</span>)}</div></div><button onClick={() => onSelect(recommendation.cajon)} disabled={savingId !== null} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-3 text-sm font-black text-zinc-950 hover:bg-emerald-400 disabled:opacity-50">{savingId === recommendation.cajon.id ? <Loader2 className="animate-spin" size={17} /> : <Sparkles size={17} />}{piece.cajon_id ? "Trasladar al recomendado" : "Guardar en el recomendado"}</button></div></section>}
        <label className="relative block"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={18} /><input autoFocus value={query} onChange={(event) => onQuery(event.target.value)} placeholder="Buscar otro cajón por código, nombre o ubicación..." className="w-full rounded-xl border border-zinc-700 bg-zinc-950 py-3 pl-10 pr-4 text-white outline-none focus:border-cyan-500" /></label>
        {loading ? <div className="flex items-center justify-center gap-2 py-16 text-zinc-400"><Loader2 className="animate-spin text-cyan-400" /> Buscando cajones con espacio...</div> : listedDrawers.length ? <><p className="mb-2 mt-5 text-xs font-black uppercase tracking-wide text-zinc-500">{showRecommendation ? "Otros cajones disponibles" : "Cajones disponibles"}</p><div className="grid gap-3 sm:grid-cols-2">{listedDrawers.map((drawer) => {
          const current = drawer.id === piece.cajon_id;
          return <article key={drawer.id} className={`rounded-2xl border p-4 ${current ? "border-amber-500/40 bg-amber-500/5" : "border-zinc-700 bg-zinc-950"}`}><div className="flex items-start justify-between gap-2"><div><p className="font-mono text-sm font-black text-amber-300">{drawer.codigo}</p><h3 className="font-black text-white">{drawer.nombre}</h3><p className="mt-1 font-mono text-xs text-cyan-300">{drawer.ubicacion}</p></div><span className="rounded-full bg-zinc-800 px-2 py-1 text-xs font-bold text-zinc-300">{drawer.cantidad_piezas}/{drawer.capacidad_maxima}</span></div><div className="mt-3 h-2 overflow-hidden rounded-full bg-zinc-800"><div className="h-full bg-cyan-500" style={{ width: `${drawer.porcentaje_ocupacion}%` }} /></div><button onClick={() => onSelect(drawer)} disabled={current || savingId !== null} className={`mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-black ${current ? "border border-amber-500/30 text-amber-300" : "bg-cyan-500 text-zinc-950 hover:bg-cyan-400"} disabled:opacity-50`}>{savingId === drawer.id ? <Loader2 className="animate-spin" size={16} /> : current ? <CheckCircle2 size={16} /> : <PackagePlus size={16} />}{current ? "Ya está en este cajón" : piece.cajon_id ? "Trasladar aquí" : "Guardar aquí"}</button></article>;
        })}</div></> : !showRecommendation && <div className="py-14 text-center"><Archive className="mx-auto mb-3 text-zinc-700" size={44} /><p className="font-bold text-zinc-300">No hay cajones disponibles.</p><p className="mt-1 text-sm text-zinc-500">Crea un cajón o libera espacio en uno existente.</p><Link href="/almacen-desguace/cajones" className="mt-4 inline-flex rounded-xl border border-cyan-500/30 px-4 py-2.5 font-bold text-cyan-300">Gestionar cajones</Link></div>}
      </div>
    </div>
  </div>;
}

function PhotoGalleryModal({ piece, loading, onClose }: { piece: PiezaDesguace; loading: boolean; onClose: () => void }) {
  const photos = piece.fotos || [];
  const [selectedPhoto, setSelectedPhoto] = useState(0);
  const selected = photos[selectedPhoto];
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-3 backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <div role="dialog" aria-modal="true" aria-label={`Fotografías de ${piece.nombre_pieza || piece.codigo_interno}`} className="flex max-h-[94vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-zinc-700 bg-zinc-950 shadow-2xl">
      <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3"><div className="min-w-0"><h2 className="truncate font-bold text-white">{piece.nombre_pieza || piece.codigo_interno}</h2><p className="text-xs text-zinc-500">{loading ? "Cargando fotografías…" : `${photos.length} fotografía${photos.length === 1 ? "" : "s"}`}</p></div><button onClick={onClose} title="Cerrar" className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-800 hover:text-white"><X /></button></div>
      {loading ? <div className="flex min-h-80 items-center justify-center gap-2 text-zinc-400"><Loader2 className="animate-spin text-cyan-400" /> Cargando galería...</div> : !photos.length ? <div className="flex min-h-80 flex-col items-center justify-center text-zinc-500"><Camera size={48} /><p className="mt-3 font-semibold">Esta pieza no tiene fotografías.</p><Link href={`/almacen-desguace/${piece.id}#fotografias`} onClick={onClose} className="mt-4 rounded-lg bg-amber-500 px-4 py-2 font-bold text-zinc-950">Subir fotografías</Link></div> : <div className="min-h-0 overflow-y-auto p-3 sm:p-4"><div className="flex min-h-[45vh] items-center justify-center rounded-xl bg-black p-2">{selected?.url_visualizacion ? <img src={selected.url_visualizacion} alt={`${piece.nombre_pieza || "Pieza"} ${selectedPhoto + 1}`} className="max-h-[62vh] max-w-full object-contain" /> : <div className="text-zinc-500">Imagen no disponible</div>}</div>{photos.length > 1 && <div className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-6 md:grid-cols-8">{photos.map((photo, index) => <button key={photo.id} onClick={() => setSelectedPhoto(index)} className={`overflow-hidden rounded-lg border-2 ${index === selectedPhoto ? "border-cyan-400" : "border-transparent opacity-70 hover:opacity-100"}`}>{photo.url_visualizacion ? <img src={photo.url_visualizacion} alt={`Miniatura ${index + 1}`} className="aspect-square w-full object-cover" /> : <span className="flex aspect-square items-center justify-center bg-zinc-900"><Camera /></span>}</button>)}</div>}</div>}
    </div>
  </div>;
}

function Pagination({ page, totalPages, onPage }: { page: number; totalPages: number; onPage: (page: number) => void }) {
  return <div className="flex flex-wrap items-center justify-center gap-3 border-t border-zinc-800 px-4 py-4"><button onClick={() => onPage(page - 1)} disabled={page <= 1} aria-label="Página anterior" className="rounded-lg border border-zinc-700 p-2 text-zinc-300 hover:bg-zinc-800 disabled:opacity-30"><ChevronLeft size={18} /></button><label className="flex items-center gap-2 text-sm text-zinc-400">Página<select aria-label={`Página de ${totalPages}`} value={page} onChange={(event) => onPage(Number(event.target.value))} className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 font-semibold text-white">{Array.from({ length: totalPages }, (_, index) => <option key={index + 1} value={index + 1}>{index + 1}</option>)}</select>de {totalPages}</label><button onClick={() => onPage(page + 1)} disabled={page >= totalPages} aria-label="Página siguiente" className="rounded-lg border border-zinc-700 p-2 text-zinc-300 hover:bg-zinc-800 disabled:opacity-30"><ChevronRight size={18} /></button></div>;
}

function BulkValue({ field, value, onChange }: { field: BulkField; value: string; onChange: (value: string) => void }) {
  if (field === "estado_pieza") return <select value={value} onChange={(event) => onChange(event.target.value)} className="bulk-input"><option value="">Selecciona estado</option>{ESTADOS_PIEZA.map((item) => <option key={item}>{item}</option>)}</select>;
  if (field === "estado_proceso") return <select value={value} onChange={(event) => onChange(event.target.value)} className="bulk-input"><option value="">Selecciona proceso</option>{ESTADOS_PROCESO.map((item) => <option key={item}>{item}</option>)}</select>;
  if (field === "publicado_online") return <select value={value} onChange={(event) => onChange(event.target.value)} className="bulk-input"><option value="">Selecciona opción</option><option value="true">Sí, publicada online</option><option value="false">No publicada online</option></select>;
  return null;
}

function FilterSelect({ value, onChange, children }: { value: string; onChange: (value: string) => void; children: ReactNode }) { return <select value={value} onChange={(event) => onChange(event.target.value)} className="rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-sm text-white focus:border-amber-500 focus:outline-none">{children}</select>; }
function FieldLabel({ label, children }: { label: string; children: ReactNode }) { return <label className="min-w-56 flex-1"><span className="mb-1 block text-xs text-amber-200/70">{label}</span>{children}</label>; }
function PrettyCheckbox({ checked, onChange, label }: { checked: boolean; onChange: () => void; label: string }) { return <label title={label} className="inline-flex cursor-pointer items-center gap-2"><input type="checkbox" checked={checked} onChange={onChange} aria-label={label} className="sr-only" /><span className={`flex h-5 w-5 items-center justify-center rounded-md border transition ${checked ? "border-amber-400 bg-amber-400 text-zinc-950 shadow-[0_0_10px_rgba(251,191,36,0.2)]" : "border-zinc-600 bg-zinc-900 text-transparent hover:border-amber-500"}`}><Check size={14} strokeWidth={3} /></span></label>; }
function OnlineBadge({ online, large = false }: { online: boolean; large?: boolean }) { return online ? <span className={`inline-flex items-center gap-1 rounded-full bg-emerald-500/10 font-bold text-emerald-300 ${large ? "min-h-10 px-3 py-2 text-sm" : "px-2 py-1 text-[10px]"}`}><CheckCircle2 size={large ? 16 : 12} /> Online</span> : <span className={`inline-flex rounded-full bg-zinc-800 font-semibold text-zinc-500 ${large ? "min-h-10 items-center px-3 py-2 text-sm" : "px-2 py-1 text-[10px]"}`}>No online</span>; }
function DetailItem({ label, value }: { label: string; value: string | number | null | undefined }) { return <div className="rounded-lg bg-zinc-900 px-3 py-2"><span className="block text-[10px] uppercase text-zinc-600">{label}</span><span className="text-zinc-300">{value || "Sin indicar"}</span></div>; }
function ActionButton({ label, icon, onClick, danger }: { label: string; icon: ReactNode; onClick: () => void; danger?: boolean }) { return <button onClick={onClick} className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-xs font-semibold ${danger ? "border-red-500/20 text-red-300 hover:bg-red-500/10" : "border-zinc-700 text-zinc-300 hover:bg-zinc-800 hover:text-white"}`}><span className="[&>svg]:h-4 [&>svg]:w-4">{icon}</span>{label}</button>; }
function ActionLink({ label, icon, href }: { label: string; icon: ReactNode; href: string }) { return <Link href={href} className="flex items-center gap-2 rounded-lg border border-zinc-700 px-3 py-2 text-xs font-semibold text-zinc-300 hover:bg-zinc-800 hover:text-white"><span className="[&>svg]:h-4 [&>svg]:w-4">{icon}</span>{label}</Link>; }
function formatDate(value: string | null | undefined) { if (!value) return "-"; const [year, month, day] = value.slice(0, 10).split("-"); return day && month && year ? `${day}/${month}/${year}` : value; }
