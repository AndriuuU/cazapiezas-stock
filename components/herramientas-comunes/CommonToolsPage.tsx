/* eslint-disable @next/next/no-img-element */
"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import { AlertTriangle, Archive, ArrowDown, ArrowLeft, ArrowUp, Camera, CheckCircle2, ChevronRight, ClipboardCheck, Clock3, Copy, Edit3, Grip, History, ImagePlus, LayoutGrid, List, Loader2, MapPin, MoreHorizontal, Nfc, PackagePlus, Plus, QrCode, RotateCcw, ScanLine, Search, Settings, Trash2, UserRound, Wrench, X } from "lucide-react";
import BarcodeScanner from "@/components/almacen-desguace/BarcodeScanner";
import { ShelfLocationLabelsButton, ToolQrLabelButton } from "@/components/herramientas-comunes/CommonToolLabels";
import { buildToolQrPath, parseCommonToolsQr } from "@/lib/herramientas-comunes-qr";
import { PHOTO_SOURCE_MAX_BYTES } from "@/lib/photo-upload";
import { optimizePhoto } from "@/lib/photo-upload-client";
import type { AppUser } from "@/lib/app-users";
import { ActionActorSelect, useActionActors } from "@/components/auth/ActionActorSelect";
import { DEFAULT_TOOL_SETTINGS, type ToolSettings } from "@/lib/app-settings";
import type { ConfiguracionEstanteriaHerramientas, EstadoHerramienta, EstanteriaHerramientas, FilaEstanteriaHerramientas, HerramientaComun, InventarioHerramientaItem, InventarioHerramientas, MovimientoHerramienta, TipoIncidenciaHerramienta } from "@/types/herramientas-comunes";

type Data = { shelves: EstanteriaHerramientas[]; tools: HerramientaComun[]; archivedTools: HerramientaComun[]; movements: MovimientoHerramienta[]; settings: ToolSettings };
type ScannedLocation = { shelf: EstanteriaHerramientas; level: number; position: string };
type ReturnDraft = { actorUserId: string; actorName: string; incidentType: TipoIncidenciaHerramienta | null; detail: string; photo: File | null };
type GlobalMovement = MovimientoHerramienta & { herramienta: { id: number; codigo: string; nombre: string; foto_url: string | null; archivada: boolean } | null };
const EMPTY_DATA: Data = { shelves: [], tools: [], archivedTools: [], movements: [], settings: DEFAULT_TOOL_SETTINGS };
const STATUS: Record<EstadoHerramienta, { label: string; classes: string }> = {
  disponible: { label: "Disponible", classes: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300" },
  prestada: { label: "En uso", classes: "border-amber-500/30 bg-amber-500/10 text-amber-300" },
  reparacion: { label: "No localizada", classes: "border-red-500/30 bg-red-500/10 text-red-300" },
  perdida: { label: "No encontrada", classes: "border-red-500/30 bg-red-500/10 text-red-300" },
};

export default function CommonToolsPage() {
  const [data, setData] = useState<Data>(EMPTY_DATA);
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  const { users: actionUsers, loading: actionUsersLoading } = useActionActors(currentUser);
  const [query, setQuery] = useState("");
  const [listQuery, setListQuery] = useState("");
  const [listCategory, setListCategory] = useState("");
  const [status, setStatus] = useState<EstadoHerramienta | "">("");
  const [view, setView] = useState<"lista" | "estanterias" | "prestamos">("lista");
  const [mobileTab, setMobileTab] = useState<"buscar" | "lista" | "prestamos" | "plano" | "mas">("buscar");
  const searchInput = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(true);
  const [setupRequired, setSetupRequired] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [creating, setCreating] = useState(false);
  const [managingShelves, setManagingShelves] = useState(false);
  const [loanTool, setLoanToolState] = useState<HerramientaComun | null>(null);
  const [loanError, setLoanError] = useState("");
  const [historyTool, setHistoryTool] = useState<HerramientaComun | null>(null);
  const [globalHistoryOpen, setGlobalHistoryOpen] = useState(false);
  const [locationTool, setLocationTool] = useState<HerramientaComun | null>(null);
  const [editingTool, setEditingTool] = useState<HerramientaComun | null>(null);
  const [scannedTool, setScannedTool] = useState<HerramientaComun | null>(null);
  const [reportTool, setReportTool] = useState<HerramientaComun | null>(null);
  const [scannedLocation, setScannedLocation] = useState<ScannedLocation | null>(null);
  const [scannerMode, setScannerMode] = useState<"general" | "return-location" | "assign-location" | null>(null);
  const [returningTool, setReturningTool] = useState<HerramientaComun | null>(null);
  const [returnFormTool, setReturnFormTool] = useState<HerramientaComun | null>(null);
  const [pendingReturn, setPendingReturn] = useState<ReturnDraft | null>(null);
  const [placingTool, setPlacingTool] = useState<HerramientaComun | null>(null);
  const [planTool, setPlanTool] = useState<HerramientaComun | null>(null);
  const [unlocatedOpen, setUnlocatedOpen] = useState(false);
  const [labelsOpen, setLabelsOpen] = useState(false);
  const [labelTool, setLabelTool] = useState<HerramientaComun | null>(null);
  const [nfcTool, setNfcTool] = useState<HerramientaComun | null>(null);
  const [archiveTool, setArchiveTool] = useState<HerramientaComun | null>(null);
  const [archivedOpen, setArchivedOpen] = useState(false);
  const [incidentsOpen, setIncidentsOpen] = useState(false);
  const [photoPreview, setPhotoPreview] = useState<{ url: string; alt: string } | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const handledInitialQr = useRef(false);
  const backgroundRefreshInFlight = useRef(false);

  const load = useCallback(async ({ silent = false }: { silent?: boolean } = {}) => {
    if (silent && backgroundRefreshInFlight.current) return;
    if (silent) backgroundRefreshInFlight.current = true;
    else setLoading(true);
    try {
      const [response, settingsResponse] = await Promise.all([fetch("/api/herramientas-comunes", { cache: "no-store" }), fetch("/api/configuracion/herramientas", { cache: "no-store" })]);
      const payload = await response.json() as Data & { error?: string; setupRequired?: boolean };
      const settingsPayload = await settingsResponse.json().catch(() => ({})) as { settings?: ToolSettings };
      payload.settings = settingsPayload.settings || DEFAULT_TOOL_SETTINGS;
      payload.archivedTools ||= [];
      setSetupRequired(Boolean(payload.setupRequired));
      if (!response.ok) throw new Error(payload.error || "No se pudieron cargar las herramientas.");
      setData(payload);
      setError(""); setSetupRequired(false);
      return payload;
    } catch (caught) {
      if (!silent) setError(caught instanceof Error ? caught.message : "No se pudieron cargar las herramientas.");
    } finally {
      if (silent) backgroundRefreshInFlight.current = false;
      else setLoading(false);
    }
  }, []);

  useEffect(() => { void Promise.resolve().then(() => load()); }, [load]);
  useEffect(() => {
    const refreshWhenActive = () => {
      if (document.visibilityState === "visible") void load({ silent: true });
    };
    const interval = window.setInterval(refreshWhenActive, 3000);
    window.addEventListener("focus", refreshWhenActive);
    document.addEventListener("visibilitychange", refreshWhenActive);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", refreshWhenActive);
      document.removeEventListener("visibilitychange", refreshWhenActive);
    };
  }, [load]);
  useEffect(() => {
    void fetch("/api/auth/me", { cache: "no-store" }).then((response) => response.json()).then((payload: { user?: AppUser }) => setCurrentUser(payload.user || null)).catch(() => setCurrentUser(null));
  }, []);
  useEffect(() => {
    if (!error && !success) return;
    const timeout = window.setTimeout(() => {
      setError("");
      setSuccess("");
    }, 3000);
    return () => window.clearTimeout(timeout);
  }, [error, success]);

  const visible = useMemo(() => {
    const term = normalize(query);
    return data.tools.filter((tool) => {
      if (!term && status && tool.estado !== status) return false;
      if (!term) return true;
      return normalize([tool.codigo, tool.nombre, tool.categoria, tool.marca, tool.descripcion, tool.espacio_ocupado, tool.empleado_actual, tool.vehiculo_actual, tool.estanteria?.codigo, tool.estanteria?.zona, tool.posicion].filter(Boolean).join(" ")).includes(term);
    });
  }, [data.tools, query, status]);
  const categories = useMemo(() => categoryOptions(data.tools), [data.tools]);
  const listTools = useMemo(() => {
    const term = normalize(listQuery);
    return data.tools.filter((tool) => {
      if (status && tool.estado !== status) return false;
      const toolCategoryValues = splitCategories(tool.categoria);
      if (listCategory === "__sin_categoria__" && toolCategoryValues.length) return false;
      if (listCategory && listCategory !== "__sin_categoria__" && !toolCategoryValues.some((value) => normalize(value) === normalize(listCategory))) return false;
      if (!term) return true;
      return normalize([tool.codigo, tool.nombre, tool.categoria, tool.marca, tool.descripcion, tool.espacio_ocupado].filter(Boolean).join(" ")).includes(term);
    });
  }, [data.tools, listCategory, listQuery, status]);

  async function action(tool: HerramientaComun, body: Record<string, unknown>, message: string) {
    const isLoanAction = body.action === "retirar";
    setBusyId(tool.id); setError(""); setSuccess("");
    if (isLoanAction) setLoanError("");
    try {
      const response = await fetch(`/api/herramientas-comunes/${tool.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error || "No se pudo actualizar la herramienta.");
      await load();
      setSuccess(message);
      if (isLoanAction) setLoanError("");
      setLoanTool(null);
      setLocationTool(null);
      setArchiveTool(null);
    } catch (caught) {
      const actionError = caught instanceof Error ? caught.message : "No se pudo actualizar la herramienta.";
      setError(actionError);
      if (isLoanAction) setLoanError(actionError);
    }
    finally { setBusyId(null); }
  }

  async function setIdentification(tool: HerramientaComun, identificacion: "qr" | "nfc", completado: boolean) {
    const response = await fetch(`/api/herramientas-comunes/${tool.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "identificacion", identificacion, completado }) });
    const payload = await response.json() as HerramientaComun & { error?: string };
    if (!response.ok) throw new Error(payload.error || "No se pudo guardar el estado de la etiqueta.");
    setData((current) => ({ ...current, tools: current.tools.map((item) => item.id === payload.id ? { ...item, ...payload } : item) }));
    setNfcTool((current) => current?.id === payload.id ? { ...current, ...payload } : current);
    return payload;
  }

  async function completeReturn(tool: HerramientaComun, draft: ReturnDraft, confirmedLocation?: { shelfId: number; level: number; position: string }) {
    setBusyId(tool.id); setError(""); setSuccess("");
    try {
      const response = await fetch(`/api/herramientas-comunes/${tool.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "devolver", actor_user_id: draft.actorUserId, incidencia_tipo: draft.incidentType, detalle: draft.detail, ...(confirmedLocation ? { estanteria_id: confirmedLocation.shelfId, nivel: confirmedLocation.level, posicion: confirmedLocation.position } : {}) }) });
      const payload = await response.json() as { error?: string; incidencia_movimiento_id?: number | null };
      if (!response.ok) throw new Error(payload.error || "No se pudo devolver la herramienta.");
      setReturningTool(null); setPendingReturn(null); setReturnFormTool(null);
      if (draft.photo && payload.incidencia_movimiento_id) {
        const optimized = await optimizePhoto(draft.photo);
        const photoResponse = await fetch(`/api/herramientas-comunes/${tool.id}/movimientos/${payload.incidencia_movimiento_id}/foto`, { method: "POST", headers: { "Content-Type": optimized.type || "image/jpeg" }, body: optimized });
        const photoPayload = await photoResponse.json().catch(() => ({})) as { error?: string };
        if (!photoResponse.ok) { await load(); throw new Error(`La devolución está guardada, pero no la foto: ${photoPayload.error || "no se pudo subir"}.`); }
      }
      await load();
      setSuccess(draft.incidentType ? `${tool.nombre} devuelta con la incidencia registrada.` : `${tool.nombre} devuelta correctamente.`);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "No se pudo devolver la herramienta."); }
    finally { setBusyId(null); }
  }

  function handleScan(rawValue: string) {
    const parsed = parseCommonToolsQr(rawValue, window.location.origin);
    const mode = scannerMode;
    setScannerMode(null);
    setError(""); setSuccess("");
    if (parsed.kind === "tool" || parsed.kind === "tool-token") {
      if (mode === "return-location" || mode === "assign-location") {
        setError("Escanea la etiqueta del hueco de la estantería, no otra herramienta.");
        return;
      }
      const tool = parsed.kind === "tool-token" ? data.tools.find((item) => item.qr_token === parsed.token) : data.tools.find((item) => normalize(item.codigo) === normalize(parsed.code));
      if (!tool) { setError(parsed.kind === "tool-token" ? "Esta etiqueta QR no corresponde a ninguna herramienta activa." : `No encontramos la herramienta ${parsed.code}.`); return; }
      setScannedTool(tool);
      setQuery(tool.codigo);
      setMobileTab("buscar");
      return;
    }
    if (parsed.kind === "location") {
      const shelf = data.shelves.find((item) => item.id === parsed.shelfId);
      const row = shelf?.configuracion.filas.find((item) => item.nivel === parsed.level);
      if (!shelf || !row || Number(parsed.position.slice(1)) > row.columnas) { setError("Esta etiqueta pertenece a una ubicación que ya no existe en el plano."); return; }
      const locationValue = { shelf, level: parsed.level, position: parsed.position };
      if (mode === "assign-location" && placingTool) {
        const tool = placingTool;
        setPlacingTool(null);
        void action(tool, { action: "ubicacion", estanteria_id: shelf.id, nivel: parsed.level, posicion: parsed.position }, `${tool.nombre} colocada en ${locationName(shelf, parsed.level, parsed.position)}.`);
        return;
      }
      if (mode === "return-location" && returningTool) {
        const correct = returningTool.estanteria_id === shelf.id && returningTool.nivel === parsed.level && normalizePosition(returningTool.posicion) === parsed.position;
        if (correct) {
          const tool = returningTool;
          const draft = pendingReturn;
          if (!draft) { setReturningTool(null); setError("Vuelve a iniciar la devolución."); return; }
          void completeReturn(tool, draft, { shelfId: shelf.id, level: parsed.level, position: parsed.position });
        } else {
          setScannedLocation(locationValue);
        }
        return;
      }
      setScannedLocation(locationValue);
      setMobileTab("plano");
      return;
    }
    setError("No reconocemos este código QR.");
  }

  useEffect(() => {
    if (handledInitialQr.current || loading || !data.shelves.length) return;
    const params = new URLSearchParams(window.location.search);
    if (!params.has("herramienta") && !params.has("herramienta_qr") && !params.has("ubicacion")) return;
    handledInitialQr.current = true;
    const scannedUrl = window.location.href;
    window.history.replaceState({}, "", window.location.pathname);
    const timer = window.setTimeout(() => handleScan(scannedUrl), 0);
    return () => window.clearTimeout(timer);
    // Solo procesamos una vez el QR con el que se abrió la página.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, data.tools.length, data.shelves.length]);

  const available = data.tools.filter((tool) => tool.estado === "disponible").length;
  const loaned = data.tools.filter((tool) => tool.estado === "prestada").length;
  const overdueTools = data.tools.filter((tool) => isLoanOverdue(tool, data.settings.loanOverdueHours));
  const openIncidents = data.tools.filter((tool) => Boolean(tool.incidencia_abierta_tipo));
  const missing = data.tools.filter((tool) => tool.estado === "perdida").length;
  const unlocatedTools = data.tools.filter((tool) => !tool.estanteria_id || tool.nivel === null || !tool.posicion);
  const mobileAttention = data.tools.filter((tool) => tool.estado === "perdida" || !tool.estanteria_id || tool.nivel === null || !tool.posicion).length;
  const isAdmin = currentUser?.rol === "administrador";
  const searching = Boolean(query.trim());
  function showLocation(tool: HerramientaComun) { setStatus(""); setQuery(tool.codigo); setMobileTab("buscar"); window.setTimeout(() => searchInput.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 0); }
  function showMissingTools() { setQuery(""); setStatus("perdida"); setView("lista"); setMobileTab("lista"); }
  function beginReturn(tool: HerramientaComun) {
    setReturnFormTool(tool);
  }
  function setLoanTool(tool: HerramientaComun | null) {
    setLoanError("");
    setLoanToolState(tool);
  }
  return <main onClick={(event) => { const target = event.target; if (target instanceof HTMLImageElement && target.currentSrc) setPhotoPreview({ url: target.currentSrc, alt: target.alt || "Fotografía de la herramienta" }); }} className="min-h-screen bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950 text-zinc-100">
    <header className="border-b border-zinc-800 bg-zinc-950/90"><div className="mx-auto flex max-w-[1500px] items-center justify-between gap-3 px-4 py-4 sm:px-6"><div className="flex min-w-0 items-center gap-3"><span className="rounded-xl border border-cyan-500/30 bg-cyan-500/10 p-2.5 text-cyan-300"><Wrench size={24} /></span><div><h1 className="truncate text-lg font-black">HERRAMIENTAS COMUNES</h1><p className="truncate text-xs text-zinc-500">Ubicación, disponibilidad y préstamos</p></div></div><Link href="/" className="inline-flex items-center gap-2 rounded-xl border border-zinc-700 px-3 py-2 text-sm font-bold text-zinc-300 hover:bg-zinc-800"><ArrowLeft size={16} /><span className="hidden sm:inline">Volver al inicio</span></Link></div></header>
    <div className="mx-auto max-w-[1500px] space-y-5 px-4 py-4 pb-28 sm:px-6 sm:py-6 sm:pb-6">
      <section className="hidden grid-cols-4 gap-3 sm:grid"><Summary label="Herramientas" value={data.tools.length} tone="cyan" /><Summary label="Disponibles" value={available} tone="emerald" /><Summary label="Prestadas" value={loaned} tone="amber" /><Summary label="Con retraso" value={overdueTools.length} tone={overdueTools.length ? "red" : "emerald"} /></section>
      {overdueTools.length > 0 && <section className="flex flex-wrap gap-2"><button onClick={() => { setView("prestamos"); setMobileTab("prestamos"); setQuery(""); }} className="inline-flex min-h-12 items-center gap-2 rounded-xl border border-red-500/35 bg-red-500/10 px-4 font-black text-red-200"><Clock3 size={18} />{overdueTools.length} préstamo{overdueTools.length === 1 ? "" : "s"} con retraso</button></section>}
      {error && <Notice tone="red">{error}</Notice>}{success && <Notice tone="green">{success}</Notice>}
      {setupRequired && <section className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-5"><h2 className="font-black text-amber-200">Falta activar la última actualización</h2><p className="mt-2 text-sm leading-6 text-amber-100/75">Aplica en la base de datos la actualización <strong>202608190002_layout_estanterias_herramientas.sql</strong> para cargar el plano configurable de las seis estanterías.</p></section>}
      {isAdmin && <div className="hidden justify-end sm:flex"><InventoryLauncher /></div>}
      <section className={`${mobileTab === "buscar" ? "block" : "hidden"} rounded-2xl border border-cyan-500/20 bg-zinc-900/95 p-3 shadow-2xl sm:block sm:p-4`}><div className="grid gap-2 sm:grid-cols-[1fr_auto]"><label className="relative block"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-cyan-400" size={21} /><input ref={searchInput} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="¿Qué herramienta buscas?" autoComplete="off" className="w-full rounded-xl border border-zinc-700 bg-zinc-950 py-4 pl-11 pr-11 text-base font-semibold outline-none focus:border-cyan-400 sm:py-3" />{searching && <button onClick={() => setQuery("")} aria-label="Limpiar búsqueda" className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-2 text-zinc-400 hover:bg-zinc-800"><X size={18} /></button>}</label><button onClick={() => { setReturningTool(null); setScannerMode("general"); }} className="inline-flex min-h-14 items-center justify-center gap-2 rounded-xl bg-cyan-400 px-5 font-black text-zinc-950 sm:min-h-0"><ScanLine size={21} /> Escanear QR</button></div>{searching && <p className="mt-2 px-1 text-xs font-bold text-cyan-300">{visible.length ? `${visible.length} resultado${visible.length === 1 ? "" : "s"} · ubicación mostrada en el plano` : "Sin resultados"}</p>}<div className="mt-3 hidden flex-wrap gap-2 sm:flex"><div className="grid grid-cols-3 rounded-xl border border-zinc-700 bg-zinc-950 p-1"><ViewButton active={view === "lista"} onClick={() => setView("lista")}><List size={17} /> Lista</ViewButton><ViewButton active={view === "prestamos"} onClick={() => setView("prestamos")}><UserRound size={17} /> Prestadas</ViewButton><ViewButton active={view === "estanterias"} onClick={() => setView("estanterias")}><LayoutGrid size={17} /> Plano</ViewButton></div><select value={status} onChange={(event) => setStatus(event.target.value as EstadoHerramienta | "")} className="min-w-0 rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-3 text-sm outline-none focus:border-cyan-500"><option value="">Todos los estados</option>{Object.entries(STATUS).filter(([value]) => value !== "reparacion").map(([value, item]) => <option key={value} value={value}>{item.label}</option>)}</select>{isAdmin && <><button onClick={() => setCreating(true)} className="inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-400 px-3 py-3 text-sm font-black text-zinc-950"><PackagePlus size={17} /> Registrar</button><button onClick={() => setManagingShelves(true)} className="inline-flex items-center justify-center gap-2 rounded-xl border border-zinc-700 px-3 py-3 text-sm font-bold text-zinc-300"><Settings size={17} /> Configurar estanterías</button><button onClick={() => setLabelsOpen(true)} className="inline-flex items-center justify-center gap-2 rounded-xl border border-amber-500/30 px-3 py-3 text-sm font-bold text-amber-200"><QrCode size={17} /> Etiquetas QR</button></>}<details className="relative ml-auto"><summary className="flex cursor-pointer list-none items-center gap-2 rounded-xl border border-zinc-700 px-3 py-3 text-sm font-bold text-zinc-300"><MoreHorizontal size={17} /> Más{openIncidents.length > 0 && <span className="rounded-full bg-orange-400 px-2 py-0.5 text-xs font-black text-zinc-950">{openIncidents.length}</span>}</summary><div className="absolute right-0 top-full z-30 mt-2 min-w-64 space-y-2 rounded-xl border border-zinc-700 bg-zinc-950 p-2 shadow-2xl"><button onClick={(event) => { event.currentTarget.closest("details")?.removeAttribute("open"); setIncidentsOpen(true); }} className="flex min-h-12 w-full items-center justify-between gap-3 rounded-lg px-3 text-left font-bold text-orange-200 hover:bg-orange-500/10"><span className="flex items-center gap-2"><AlertTriangle size={18} /> Incidencias</span><span>{openIncidents.length}</span></button>{isAdmin && <button onClick={(event) => { event.currentTarget.closest("details")?.removeAttribute("open"); setArchivedOpen(true); }} className="flex min-h-12 w-full items-center justify-between gap-3 rounded-lg px-3 text-left font-bold text-zinc-300 hover:bg-zinc-800"><span className="flex items-center gap-2"><Archive size={18} /> Archivo</span><span>{data.archivedTools.length}</span></button>}</div></details></div></section>
      <div className="sm:hidden">{loading ? <Loading /> : mobileTab === "buscar" ? searching ? visible.length ? <SearchLocationResults tools={visible} shelves={data.shelves} onTool={setScannedTool} /> : <Empty text="No encontramos ninguna herramienta con ese nombre, código o marca." /> : <SearchPrompt /> : mobileTab === "lista" ? <div className="space-y-4"><ToolListFilters query={listQuery} category={listCategory} status={status} categories={categories} resultCount={listTools.length} totalCount={data.tools.length} onQuery={setListQuery} onCategory={setListCategory} onStatus={setStatus} onClear={() => { setListQuery(""); setListCategory(""); setStatus(""); }} />{listTools.length ? <ToolList tools={listTools} admin={isAdmin} busyId={busyId} onLoan={setLoanTool} onReturn={beginReturn} onStatus={(tool, next) => void action(tool, { action: "estado", estado: next }, `${tool.nombre} actualizada.`)} onHistory={setHistoryTool} onLocation={setLocationTool} onEdit={setEditingTool} onShowLocation={showLocation} /> : <Empty text="No hay herramientas que coincidan con estos filtros." />}</div> : mobileTab === "prestamos" ? <BorrowedToolsList tools={data.tools.filter((tool) => tool.estado === "prestada")} overdueHours={data.settings.loanOverdueHours} busyId={busyId} onReturn={beginReturn} onShowLocation={showLocation} /> : mobileTab === "plano" ? <ShelfView shelves={data.shelves} tools={data.tools} onTool={setScannedTool} /> : <MobileMore admin={isAdmin} missing={missing} unlocated={unlocatedTools.length} archived={data.archivedTools.length} incidents={openIncidents.length} onHistory={() => setGlobalHistoryOpen(true)} onMissing={showMissingTools} onUnlocated={() => setUnlocatedOpen(true)} onCreate={() => setCreating(true)} onShelves={() => setManagingShelves(true)} onLabels={() => setLabelsOpen(true)} onArchive={() => setArchivedOpen(true)} onIncidents={() => setIncidentsOpen(true)} />}</div>
      <div className="hidden sm:block">{loading ? <Loading /> : searching ? visible.length ? <SearchLocationResults tools={visible} shelves={data.shelves} onTool={setScannedTool} /> : <Empty text="No encontramos ninguna herramienta con ese nombre, código o marca." /> : view === "lista" ? <ToolList tools={visible} admin={isAdmin} busyId={busyId} onLoan={setLoanTool} onReturn={beginReturn} onStatus={(tool, next) => void action(tool, { action: "estado", estado: next }, `${tool.nombre} actualizada.`)} onHistory={setHistoryTool} onLocation={setLocationTool} onEdit={setEditingTool} onShowLocation={showLocation} /> : view === "prestamos" ? <BorrowedToolsList tools={data.tools.filter((tool) => tool.estado === "prestada")} overdueHours={data.settings.loanOverdueHours} busyId={busyId} onReturn={beginReturn} onShowLocation={showLocation} /> : <ShelfView shelves={data.shelves} tools={visible} onTool={setScannedTool} />}</div>
    </div>
    <MobileBottomNav active={mobileTab} loaned={loaned} missing={mobileAttention} onChange={(tab) => { setMobileTab(tab); if (tab !== "buscar") setQuery(""); else window.setTimeout(() => searchInput.current?.focus(), 0); }} />
    {creating && <CreateToolModal shelves={data.shelves} categories={categories} requirePhoto={data.settings.requirePhotoOnCreate} onClose={() => setCreating(false)} onCreated={async (toolId, located) => { setCreating(false); const refreshed = await load(); setLabelTool(refreshed?.tools.find((tool) => tool.id === toolId) || null); setSuccess(located ? "Herramienta registrada en su ubicación." : "Herramienta registrada sin ubicación. Puedes colocarla después mediante QR o desde el plano."); }} />}
    {managingShelves && <ShelfManager shelves={data.shelves} onClose={() => setManagingShelves(false)} onChanged={() => void load()} />}
    {loanTool && <LoanModal tool={loanTool} currentUser={currentUser} actionUsers={actionUsers} actionUsersLoading={actionUsersLoading} askVehicle={data.settings.askVehicleOnLoan} requireVehicle={data.settings.requireVehicleOnLoan} busy={busyId === loanTool.id} error={loanError} onClose={() => setLoanTool(null)} onConfirm={(vehicle, actorUserId, actorName) => void action(loanTool, { action: "retirar", vehiculo: vehicle, actor_user_id: actorUserId }, `${loanTool.nombre} retirada por ${actorName || currentUser?.nombre || "el usuario actual"}.`)} />}
    {returnFormTool && <ReturnToolModal tool={returnFormTool} currentUser={currentUser} actionUsers={actionUsers} actionUsersLoading={actionUsersLoading} allowIncidents={data.settings.allowReturnIncidents} requireIncidentComment={data.settings.requireIncidentComment} busy={busyId === returnFormTool.id} onClose={() => setReturnFormTool(null)} onConfirm={(draft) => { const tool = returnFormTool; setReturnFormTool(null); if (data.settings.requireLocationScanOnReturn) { setPendingReturn(draft); setReturningTool(tool); setScannerMode("return-location"); } else void completeReturn(tool, draft); }} />}
    {historyTool && <HistoryModal tool={historyTool} movements={data.movements.filter((item) => item.herramienta_id === historyTool.id)} onClose={() => setHistoryTool(null)} />}
    {globalHistoryOpen && <GlobalHistoryModal onClose={() => setGlobalHistoryOpen(false)} />}
    {locationTool && <LocationModal tool={locationTool} shelves={data.shelves} busy={busyId === locationTool.id} onClose={() => setLocationTool(null)} onConfirm={(shelfId, level, position) => void action(locationTool, { action: "ubicacion", estanteria_id: shelfId, nivel: level, posicion: position }, `${locationTool.nombre} movida a su nueva ubicación.`)} />}
    {editingTool && <EditToolModal tool={editingTool} categories={categories} onClose={() => setEditingTool(null)} onSaved={async () => { const toolId = editingTool.id; setEditingTool(null); const refreshed = await load(); setLabelTool(refreshed?.tools.find((tool) => tool.id === toolId) || null); setSuccess("Herramienta actualizada correctamente."); }} />}
    {scannerMode && <BarcodeScanner allowManualEntry={scannerMode === "general" || data.settings.allowManualLocationCode} title={scannerMode === "return-location" ? "Escanear lugar de devolución" : scannerMode === "assign-location" ? "Escanear dónde la colocas" : "Escanear herramienta o ubicación"} description={scannerMode === "return-location" ? `Busca la etiqueta de ${location(returningTool!)}` : scannerMode === "assign-location" ? `Escanea el QR del hueco donde guardas ${placingTool?.nombre || "la herramienta"}.` : "Apunta al QR de una herramienta o de un hueco."} manualPlaceholder={scannerMode === "general" ? "Código de herramienta o ubicación" : "Ej. UB-5-N3-C2"} manualHint={scannerMode === "general" ? "También puedes escribir el código visible de la herramienta o ubicación." : "Si la cámara falla, escribe el código UB impreso junto al QR de la ubicación."} onScan={handleScan} onClose={() => { setScannerMode(null); if (scannerMode === "return-location") { setReturningTool(null); setPendingReturn(null); } if (scannerMode === "assign-location") setPlacingTool(null); }} />}
    {scannedTool && <ScannedToolModal tool={scannedTool} busy={busyId === scannedTool.id} canManage={isAdmin} canReportMissing={isAdmin || data.settings.employeesCanMarkMissing} onClose={() => setScannedTool(null)} onLoan={() => { const tool = scannedTool; setScannedTool(null); setLoanTool(tool); }} onReturn={() => { const tool = scannedTool; setScannedTool(null); beginReturn(tool); }} onPlace={() => { const tool = scannedTool; setScannedTool(null); setPlacingTool(tool); setScannerMode("assign-location"); }} onChoosePlan={() => { const tool = scannedTool; setScannedTool(null); setPlanTool(tool); }} onShowLocation={() => { const tool = scannedTool; setScannedTool(null); showLocation(tool); }} onHistory={() => { const tool = scannedTool; setScannedTool(null); setHistoryTool(tool); }} onMove={() => { const tool = scannedTool; setScannedTool(null); setLocationTool(tool); }} onNfc={() => { const tool = scannedTool; setScannedTool(null); setNfcTool(tool); }} onReportMissing={() => { const tool = scannedTool; setScannedTool(null); setReportTool(tool); }} onFound={() => { const tool = scannedTool; setScannedTool(null); void action(tool, { action: "estado", estado: "disponible", detalle: "Herramienta localizada de nuevo." }, `${tool.nombre} marcada como encontrada y disponible.`); }} />}
    {reportTool && <ReportMissingModal tool={reportTool} busy={busyId === reportTool.id} onClose={() => setReportTool(null)} onConfirm={() => { const tool = reportTool; setReportTool(null); void action(tool, { action: "estado", estado: "perdida", detalle: "Se ha reportado que la herramienta no está en la ubicación indicada." }, `${tool.nombre} reportada como no encontrada.`); }} />}
    {planTool && <PlaceToolPlanModal tool={planTool} shelves={data.shelves} busy={busyId === planTool.id} onClose={() => setPlanTool(null)} onConfirm={(shelf, level, position) => { const tool = planTool; setPlanTool(null); void action(tool, { action: "ubicacion", estanteria_id: shelf.id, nivel: level, posicion: position }, `${tool.nombre} colocada en ${locationName(shelf, level, position)}.`); }} />}
    {unlocatedOpen && <UnlocatedToolsModal tools={unlocatedTools} onClose={() => setUnlocatedOpen(false)} onScan={(tool) => { setUnlocatedOpen(false); setPlacingTool(tool); setScannerMode("assign-location"); }} onPlan={(tool) => { setUnlocatedOpen(false); setPlanTool(tool); }} />}
    {scannedLocation && <ScannedLocationModal value={scannedLocation} tools={data.tools.filter((tool) => tool.estanteria_id === scannedLocation.shelf.id && tool.nivel === scannedLocation.level && normalizePosition(tool.posicion) === scannedLocation.position)} returningTool={returningTool} onClose={() => { setScannedLocation(null); setReturningTool(null); setPendingReturn(null); }} onRetry={() => { setScannedLocation(null); setScannerMode("return-location"); }} />}
    {labelsOpen && <LabelsModal tools={data.tools} shelves={data.shelves} onClose={() => setLabelsOpen(false)} onPrinted={(tool) => setIdentification(tool, "qr", true)} onReset={(tool, kind) => setIdentification(tool, kind, false)} onNfc={setNfcTool} />}
    {labelTool && <ToolLabelAfterSaveModal tool={labelTool} onClose={() => setLabelTool(null)} onPrinted={(tool) => setIdentification(tool, "qr", true)} onNfc={() => { const tool = labelTool; setLabelTool(null); setNfcTool(tool); }} />}
    {nfcTool && <NfcToolModal tool={nfcTool} onClose={() => setNfcTool(null)} onStatus={(completed) => setIdentification(nfcTool, "nfc", completed)} />}
    {archiveTool && <ArchiveToolModal tool={archiveTool} busy={busyId === archiveTool.id} onClose={() => setArchiveTool(null)} onConfirm={(reason) => void action(archiveTool, { action: "archivar", detalle: reason }, `${archiveTool.nombre} archivada.`)} />}
    {archivedOpen && <ArchivedToolsModal activeTools={data.tools} archivedTools={data.archivedTools} busyId={busyId} onClose={() => setArchivedOpen(false)} onArchive={(tool) => { setArchivedOpen(false); setArchiveTool(tool); }} onRestore={(tool) => void action(tool, { action: "restaurar" }, `${tool.nombre} restaurada.`)} onHistory={(tool) => { setArchivedOpen(false); setHistoryTool(tool); }} />}
    {incidentsOpen && <IncidentToolsModal tools={openIncidents} admin={isAdmin} busyId={busyId} onClose={() => setIncidentsOpen(false)} onResolve={(tool) => { setIncidentsOpen(false); void action(tool, { action: "resolver_incidencia" }, `Incidencia de ${tool.nombre} resuelta.`); }} onHistory={(tool) => { setIncidentsOpen(false); setHistoryTool(tool); }} />}
    {photoPreview && <PhotoPreview url={photoPreview.url} alt={photoPreview.alt} onClose={() => setPhotoPreview(null)} />}
  </main>;
}

type ToolListProps = { tools: HerramientaComun[]; admin: boolean; busyId: number | null; onLoan: (tool: HerramientaComun) => void; onReturn: (tool: HerramientaComun) => void; onStatus: (tool: HerramientaComun, status: EstadoHerramienta) => void; onHistory: (tool: HerramientaComun) => void; onLocation: (tool: HerramientaComun) => void; onEdit: (tool: HerramientaComun) => void; onShowLocation: (tool: HerramientaComun) => void };

function ToolListFilters({ query, category, status, categories, resultCount, totalCount, onQuery, onCategory, onStatus, onClear }: { query: string; category: string; status: EstadoHerramienta | ""; categories: string[]; resultCount: number; totalCount: number; onQuery: (value: string) => void; onCategory: (value: string) => void; onStatus: (value: EstadoHerramienta | "") => void; onClear: () => void }) {
  const filtered = Boolean(query.trim() || category || status);
  return <section aria-label="Filtrar lista de herramientas" className="rounded-2xl border border-cyan-500/25 bg-zinc-900/95 p-3 shadow-lg shadow-black/20">
    <label className="relative block">
      <span className="sr-only">Buscar en la lista</span>
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-cyan-400" size={20} />
      <input value={query} onChange={(event) => onQuery(event.target.value)} type="search" inputMode="search" autoComplete="off" placeholder="Buscar por nombre, código o marca" className="min-h-13 w-full rounded-xl border border-zinc-700 bg-zinc-950 py-3 pl-11 pr-11 text-base font-semibold text-white outline-none placeholder:text-zinc-600 focus:border-cyan-400" />
      {query && <button type="button" onClick={() => onQuery("")} aria-label="Limpiar búsqueda de la lista" className="absolute right-1.5 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-lg text-zinc-400 active:bg-zinc-800"><X size={18} /></button>}
    </label>
    <div className="mt-2 grid grid-cols-2 gap-2">
      <label><span className="sr-only">Filtrar por categoría</span><select value={category} onChange={(event) => onCategory(event.target.value)} className="min-h-12 w-full min-w-0 rounded-xl border border-zinc-700 bg-zinc-950 px-3 text-sm font-bold text-zinc-200 outline-none focus:border-cyan-400"><option value="">Todas las categorías</option>{categories.map((item) => <option key={item} value={item}>{item}</option>)}<option value="__sin_categoria__">Sin categoría</option></select></label>
      <label><span className="sr-only">Filtrar por estado</span><select value={status} onChange={(event) => onStatus(event.target.value as EstadoHerramienta | "")} className="min-h-12 w-full min-w-0 rounded-xl border border-zinc-700 bg-zinc-950 px-3 text-sm font-bold text-zinc-200 outline-none focus:border-cyan-400"><option value="">Todos los estados</option><option value="disponible">Disponibles</option><option value="prestada">Prestadas</option><option value="perdida">No localizadas</option></select></label>
    </div>
    <div className="mt-3 flex min-h-8 items-center justify-between gap-3 px-1"><p aria-live="polite" className="text-sm font-bold text-cyan-200">{resultCount} de {totalCount} herramienta{totalCount === 1 ? "" : "s"}</p>{filtered && <button type="button" onClick={onClear} className="min-h-8 rounded-lg px-2 text-sm font-black text-cyan-300 active:bg-cyan-500/10">Limpiar filtros</button>}</div>
  </section>;
}

function ToolList(props: ToolListProps) {
  if (props.admin) return <AdminToolList {...props} />;
  if (!props.tools.length) return <Empty />;
  return <section className="grid gap-4 xl:grid-cols-2">{props.tools.map((tool) => <article key={tool.id} className="overflow-hidden rounded-2xl border border-zinc-700/80 bg-zinc-900/90 shadow-lg shadow-black/20">
    <ToolCardHeader tool={tool} />
    <footer className="grid grid-cols-2 gap-2.5 border-t border-zinc-800 bg-zinc-950/35 p-3 sm:p-4">
      <LocationButton tool={tool} onClick={() => props.onShowLocation(tool)} />
      {tool.estado === "disponible" && !tool.solo_localizacion && <button onClick={() => props.onLoan(tool)} className="col-span-2 inline-flex min-h-14 items-center justify-center gap-2 rounded-xl bg-cyan-400 px-4 font-black text-zinc-950"><Wrench size={19} /> Retirar herramienta</button>}
      {tool.estado === "prestada" && <button disabled={props.busyId === tool.id} onClick={() => props.onReturn(tool)} className="col-span-2 inline-flex min-h-14 items-center justify-center gap-2 rounded-xl bg-emerald-400 px-4 font-black text-zinc-950 disabled:opacity-50"><RotateCcw size={19} /> Devolver herramienta</button>}
      <button onClick={() => props.onHistory(tool)} className="action min-h-12"><History size={17} /> Historial</button>
      {(tool.estado === "reparacion" || tool.estado === "perdida") ? <button onClick={() => props.onStatus(tool, "disponible")} className="action action-success min-h-12"><CheckCircle2 size={17} /> Disponible</button> : tool.estado !== "prestada" ? <button onClick={() => props.onStatus(tool, "perdida")} className="action min-h-12 text-red-300"><AlertTriangle size={17} /> No localizada</button> : null}
    </footer>
  </article>)}</section>;
}

function AdminToolList({ tools, admin, busyId, onLoan, onReturn, onStatus, onHistory, onLocation, onEdit, onShowLocation }: ToolListProps) {
  void admin;
  if (!tools.length) return <Empty />;
  return <section className="grid gap-4 xl:grid-cols-2">{tools.map((tool) => <article key={tool.id} className="overflow-hidden rounded-2xl border border-zinc-700/80 bg-zinc-900/90 shadow-lg shadow-black/20">
    <ToolCardHeader tool={tool} showDetails />
    <footer className="grid grid-cols-2 gap-2.5 border-t border-zinc-800 bg-zinc-950/35 p-3 sm:p-4">
      <LocationButton tool={tool} onClick={() => onShowLocation(tool)} />
      {tool.estado === "disponible" && !tool.solo_localizacion && <button onClick={() => onLoan(tool)} className="col-span-2 inline-flex min-h-14 items-center justify-center gap-2 rounded-xl bg-cyan-400 px-4 font-black text-zinc-950"><Wrench size={19} /> Retirar herramienta</button>}
      {tool.estado === "prestada" && <button disabled={busyId === tool.id} onClick={() => onReturn(tool)} className="col-span-2 inline-flex min-h-14 items-center justify-center gap-2 rounded-xl bg-emerald-400 px-4 font-black text-zinc-950 disabled:opacity-50">{busyId === tool.id ? <Loader2 className="animate-spin" size={19} /> : <RotateCcw size={19} />} Devolver herramienta</button>}
      <details className="group col-span-2">
        <summary className="flex min-h-12 cursor-pointer list-none items-center justify-center gap-2 rounded-xl border border-zinc-700 bg-zinc-900 px-4 text-sm font-bold text-zinc-300"><MoreHorizontal size={18} /> Más acciones <span className="text-zinc-500 transition group-open:rotate-180">⌄</span></summary>
        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
          <button onClick={() => onEdit(tool)} className="action action-primary min-h-12"><Edit3 size={17} /> Editar</button>
          <button onClick={() => onHistory(tool)} className="action min-h-12"><History size={17} /> Historial</button>
          <button onClick={() => onLocation(tool)} className="action min-h-12"><MapPin size={17} /> Mover</button>
          {(tool.estado === "reparacion" || tool.estado === "perdida") && <button onClick={() => onStatus(tool, "disponible")} className="action action-success min-h-12"><CheckCircle2 size={17} /> Disponible</button>}
          {tool.estado !== "perdida" && tool.estado !== "prestada" && <button onClick={() => onStatus(tool, "perdida")} className="action min-h-12 text-red-300"><AlertTriangle size={17} /> No localizada</button>}
        </div>
      </details>
    </footer>
  </article>)}</section>;
}

function ToolCardHeader({ tool, showDetails = false }: { tool: HerramientaComun; showDetails?: boolean }) {
  return <div className="sm:flex sm:gap-4 sm:p-4">
    {tool.foto_url ? <img src={tool.foto_url} alt={`Foto de ${tool.nombre}`} loading="lazy" decoding="async" width={640} height={360} className="aspect-[16/9] w-full border-b border-zinc-700 object-cover sm:aspect-square sm:h-24 sm:w-24 sm:shrink-0 sm:rounded-xl sm:border" /> : <span role="img" aria-label={`${tool.nombre}, sin fotografía`} className="flex aspect-[16/9] w-full items-center justify-center border-b border-zinc-800 bg-zinc-950 text-zinc-600 sm:aspect-square sm:h-24 sm:w-24 sm:shrink-0 sm:rounded-xl sm:border sm:border-zinc-700"><Wrench size={36} /></span>}
    <div className="min-w-0 flex-1 p-4 sm:p-0">
      <p className="font-mono text-xs font-black tracking-wide text-cyan-300">{tool.codigo}</p>
      <h2 className="mt-0.5 text-xl font-black leading-tight text-white sm:text-lg">{tool.nombre}</h2>
      {showDetails && <p className="mt-1 text-sm text-zinc-400">{[tool.marca, tool.categoria].filter(Boolean).join(" · ") || "Sin categoría"}</p>}
      <div className="mt-3 flex flex-wrap items-center gap-2"><ToolStatusBadge tool={tool} /><ToolModeBadge tool={tool} /></div>
      {tool.estado === "prestada" && <p className="mt-3 text-sm font-bold text-amber-200">La tiene {tool.empleado_actual}{showDetails && tool.vehiculo_actual ? ` · ${tool.vehiculo_actual}` : ""}</p>}
    </div>
  </div>;
}

function LocationButton({ tool, onClick }: { tool: HerramientaComun; onClick: () => void }) {
  return <button onClick={onClick} className="col-span-2 inline-flex min-h-16 items-center justify-start gap-3 rounded-xl border border-amber-500/35 bg-amber-500/10 px-4 py-3 text-left text-amber-100">
    <MapPin className="shrink-0 text-amber-300" size={22} />
    <span className="min-w-0"><span className="block font-black leading-tight">{location(tool)}</span>{tool.espacio_ocupado && <span className="mt-1 block text-xs font-bold text-violet-200/80">Ocupa: {tool.espacio_ocupado}</span>}<span className="mt-1 block text-xs text-amber-200/65">Ver ubicación en el plano</span></span>
  </button>;
}

function BorrowedToolsList({ tools, overdueHours, busyId, onReturn, onShowLocation }: { tools: HerramientaComun[]; overdueHours: number; busyId: number | null; onReturn: (tool: HerramientaComun) => void; onShowLocation: (tool: HerramientaComun) => void }) {
  if (!tools.length) return <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-5 py-12 text-center"><CheckCircle2 className="mx-auto mb-3 text-emerald-300" size={42} /><h2 className="font-black text-emerald-100">Todas están devueltas</h2><p className="mt-1 text-sm text-emerald-200/60">Ahora mismo nadie tiene herramientas prestadas.</p></div>;
  const groups = Object.entries(Object.groupBy(tools, (tool) => tool.empleado_actual || "Sin empleado")).sort(([left], [right]) => left.localeCompare(right, "es"));
  return <div className="space-y-5"><header><h2 className="text-xl font-black text-white">Quién tiene cada herramienta</h2><p className="text-sm text-zinc-500">{tools.length} herramienta{tools.length === 1 ? "" : "s"} fuera de su ubicación · aviso a partir de {overdueHours} h</p></header>{groups.map(([employee, employeeTools]) => <section key={employee} className="overflow-hidden rounded-2xl border border-amber-500/25 bg-zinc-900/85"><header className="flex items-center justify-between bg-amber-500/10 px-4 py-3"><span className="flex items-center gap-2 font-black text-amber-100"><UserRound size={19} />{employee}</span><span className="rounded-full bg-amber-400 px-2.5 py-1 text-xs font-black text-zinc-950">{employeeTools?.length || 0}</span></header><div className="divide-y divide-zinc-800">{employeeTools?.map((tool) => <BorrowedToolCard key={tool.id} tool={tool} overdue={isLoanOverdue(tool, overdueHours)} busy={busyId === tool.id} onReturn={onReturn} onShowLocation={onShowLocation} />)}</div></section>)}</div>;
}

function BorrowedToolCard({ tool, overdue, busy, onReturn, onShowLocation }: { tool: HerramientaComun; overdue: boolean; busy: boolean; onReturn: (tool: HerramientaComun) => void; onShowLocation: (tool: HerramientaComun) => void }) {
  return <article className={`p-4 ${overdue ? "bg-red-500/10 ring-1 ring-inset ring-red-500/30" : ""}`}><div className="flex items-start justify-between gap-3"><div><p className="font-mono text-[10px] font-black text-cyan-300">{tool.codigo}</p><h3 className="font-black text-white">{tool.nombre}</h3>{overdue && <p className="mt-1 inline-flex items-center gap-1 rounded-full bg-red-400 px-2 py-1 text-xs font-black text-zinc-950"><Clock3 size={13} /> Retrasada · {elapsedLoan(tool.retirada_at)}</p>}{tool.vehiculo_actual && <p className="mt-1 text-sm font-bold text-amber-200">Vehículo: {tool.vehiculo_actual}</p>}<p className="mt-1 flex items-center gap-1 text-xs text-zinc-500"><Clock3 size={13} />Desde {formatDate(tool.retirada_at)}</p></div>{tool.foto_url && <img src={tool.foto_url} alt={tool.nombre} className="h-14 w-14 rounded-lg object-cover" />}</div><div className="mt-3 grid grid-cols-2 gap-2"><button onClick={() => onShowLocation(tool)} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-amber-500/30 text-sm font-bold text-amber-200"><MapPin size={16} /> Sitio de devolución</button><button disabled={busy} onClick={() => onReturn(tool)} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-emerald-400 text-sm font-black text-zinc-950 disabled:opacity-50">{busy ? <Loader2 className="animate-spin" size={16} /> : <RotateCcw size={16} />} Devolver</button></div></article>;
}

function MobileMore({ admin, missing, unlocated, archived, incidents, onHistory, onMissing, onUnlocated, onCreate, onShelves, onLabels, onArchive, onIncidents }: { admin: boolean; missing: number; unlocated: number; archived: number; incidents: number; onHistory: () => void; onMissing: () => void; onUnlocated: () => void; onCreate: () => void; onShelves: () => void; onLabels: () => void; onArchive: () => void; onIncidents: () => void }) {
  return <div className="space-y-6">
    <header><h2 className="text-2xl font-black text-white">Más</h2><p className="mt-1 text-sm text-zinc-500">Control y administración de herramientas</p></header>
    <MoreMenuSection title="Control diario">
      <MoreMenuButton icon={<History />} title="Historial general" description="Todos los movimientos de herramientas" onClick={onHistory} />
      <MoreMenuButton icon={<MapPin />} title="Sin ubicación" description="Colocar herramientas pendientes" count={unlocated} onClick={onUnlocated} />
      <MoreMenuButton icon={<AlertTriangle />} title="No localizadas" description="Revisar herramientas que faltan" count={missing} badgeTone={missing ? "red" : "neutral"} onClick={onMissing} />
      <MoreMenuButton icon={<AlertTriangle />} title="Incidencias" description="Daños, piezas o revisiones" count={incidents} badgeTone={incidents ? "orange" : "neutral"} onClick={onIncidents} />
    </MoreMenuSection>
    {admin && <MoreMenuSection title="Administración">
      <InventoryLauncher mobileMenu />
      <MoreMenuButton icon={<PackagePlus />} title="Registrar herramienta" description="Añadir una herramienta nueva" onClick={onCreate} />
      <MoreMenuButton icon={<QrCode />} title="Control de etiquetas" description="Ver QR y NFC pendientes o terminados" onClick={onLabels} />
      <MoreMenuButton icon={<Archive />} title="Archivo" description="Ver herramientas dadas de baja" count={archived} onClick={onArchive} />
      <MoreMenuButton icon={<Settings />} title="Configurar estanterías" description="Editar el plano y sus huecos" onClick={onShelves} />
    </MoreMenuSection>}
    <p className="px-2 text-center text-xs leading-5 text-zinc-600">Los filtros de herramientas están ahora dentro de la pestaña Lista.</p>
  </div>;
}

function MoreMenuSection({ title, children }: { title: string; children: ReactNode }) {
  return <section><h3 className="mb-2 px-1 text-xs font-black uppercase tracking-[0.16em] text-zinc-500">{title}</h3><div className="divide-y divide-zinc-800 overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/80">{children}</div></section>;
}

function MoreMenuButton({ icon, title, description, count, badgeTone = "neutral", onClick }: { icon: ReactNode; title: string; description: string; count?: number; badgeTone?: "neutral" | "red" | "orange"; onClick: () => void }) {
  const badgeClasses = badgeTone === "red" ? "bg-red-500/15 text-red-300 ring-red-500/25" : badgeTone === "orange" ? "bg-orange-500/15 text-orange-300 ring-orange-500/25" : "bg-zinc-800 text-zinc-300 ring-zinc-700";
  return <button type="button" onClick={onClick} className="flex min-h-18 w-full items-center gap-3 px-4 py-3 text-left transition active:bg-zinc-800">
    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-300 [&>svg]:h-5 [&>svg]:w-5">{icon}</span>
    <span className="min-w-0 flex-1"><span className="block font-black text-white">{title}</span><span className="mt-0.5 block text-xs leading-4 text-zinc-500">{description}</span></span>
    {count !== undefined && <span className={`flex h-8 min-w-8 shrink-0 items-center justify-center rounded-full px-2 text-sm font-black ring-1 ring-inset ${badgeClasses}`}>{count}</span>}
    <ChevronRight className="shrink-0 text-zinc-600" size={19} />
  </button>;
}

type InventoryData = { active: InventarioHerramientas | null; inventories: InventarioHerramientas[] };
type NfcInventoryRecord = { recordType: string; data?: DataView; encoding?: string };
type NfcInventoryReadingEvent = Event & { message: { records: NfcInventoryRecord[] } };
type NfcInventoryReader = {
  scan: (options?: { signal?: AbortSignal }) => Promise<void>;
  addEventListener: {
    (type: "reading", listener: (event: NfcInventoryReadingEvent) => void): void;
    (type: "readingerror", listener: () => void): void;
  };
};
type NfcInventoryReaderConstructor = new () => NfcInventoryReader;

function InventoryLauncher({ mobileMenu = false }: { mobileMenu?: boolean }) {
  const [open, setOpen] = useState(false);
  return <>{mobileMenu ? <MoreMenuButton icon={<ClipboardCheck />} title="Modo inventario" description="Escanear presentes y detectar las que faltan" onClick={() => setOpen(true)} /> : <button type="button" onClick={() => setOpen(true)} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 font-black text-emerald-100"><ClipboardCheck size={19} /> Modo inventario</button>}{open && <InventoryModal onClose={() => setOpen(false)} />}</>;
}

function InventoryModal({ onClose }: { onClose: () => void }) {
  const [data, setData] = useState<InventoryData>({ active: null, inventories: [] });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [nfcReading, setNfcReading] = useState(false);
  const [filter, setFilter] = useState<"pending" | "present" | "all">("pending");
  const [error, setError] = useState("");
  const [lastScan, setLastScan] = useState<InventarioHerramientaItem | null>(null);
  const nfcAbortRef = useRef<AbortController | null>(null);
  const nfcProcessingRef = useRef(false);
  const activeInventoryRef = useRef<InventarioHerramientas | null>(null);
  const inventoryItemsRef = useRef<InventarioHerramientaItem[]>([]);
  const lastNfcReadRef = useRef<{ value: string; at: number } | null>(null);
  const loadInventory = useCallback(async () => {
    try {
      const response = await fetch("/api/herramientas-comunes/inventarios", { cache: "no-store" });
      const payload = await response.json() as InventoryData & { error?: string };
      if (!response.ok) throw new Error(payload.error || "No se pudo cargar el inventario.");
      setData(payload); setError("");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "No se pudo cargar el inventario."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void Promise.resolve().then(loadInventory); }, [loadInventory]);
  useEffect(() => () => nfcAbortRef.current?.abort(), []);
  const active = data.active;
  const items = active?.items || [];
  useEffect(() => {
    activeInventoryRef.current = active;
    inventoryItemsRef.current = active?.items || [];
  }, [active]);
  const pending = items.filter((item) => item.resultado === "pendiente");
  const present = items.filter((item) => item.resultado === "presente");
  const shown = filter === "pending" ? pending : filter === "present" ? present : items;
  const progress = active?.total_esperadas ? Math.round((present.length / active.total_esperadas) * 100) : 0;
  const nfcSupported = typeof window !== "undefined" && window.isSecureContext && Boolean((window as Window & { NDEFReader?: NfcInventoryReaderConstructor }).NDEFReader);

  async function start() {
    setBusy(true); setError(""); setLastScan(null);
    try {
      const response = await fetch("/api/herramientas-comunes/inventarios", { method: "POST" });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error || "No se pudo iniciar el inventario.");
      await loadInventory();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "No se pudo iniciar el inventario."); }
    finally { setBusy(false); }
  }

  async function scan(rawValue: string, source: "qr" | "nfc" = "qr") {
    if (source === "qr") setScannerOpen(false);
    setError(""); setLastScan(null);
    const currentActive = activeInventoryRef.current;
    const currentItems = inventoryItemsRef.current;
    if (!currentActive) return;
    const parsed = parseCommonToolsQr(rawValue);
    if (parsed.kind === "location" || parsed.kind === "unknown") { setError("Ese código no pertenece a una herramienta. Lee la pegatina NFC o escanea el QR de la herramienta."); vibrate([100, 80, 100]); return; }
    const item = parsed.kind === "tool-token"
      ? currentItems.find((candidate) => candidate.qr_token?.toLocaleLowerCase("es") === parsed.token.toLocaleLowerCase("es"))
      : currentItems.find((candidate) => normalize(candidate.codigo) === normalize(parsed.code));
    if (!item) { setError("Esta herramienta no forma parte del inventario. Puede estar prestada, archivada o el código no es correcto."); vibrate([100, 80, 100]); return; }
    if (item.resultado === "presente") { setLastScan(item); vibrate(50); return; }
    setBusy(true);
    try {
      const response = await fetch(`/api/herramientas-comunes/inventarios/${currentActive.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "scan", herramienta_id: item.herramienta_id }) });
      const payload = await response.json() as InventarioHerramientaItem & { error?: string };
      if (!response.ok) throw new Error(payload.error || "No se pudo registrar la herramienta.");
      setLastScan({ ...item, ...payload });
      vibrate(100);
      await loadInventory();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "No se pudo registrar la herramienta."); vibrate([100, 80, 100]); }
    finally { setBusy(false); }
  }

  function stopNfc() {
    nfcAbortRef.current?.abort();
    nfcAbortRef.current = null;
    nfcProcessingRef.current = false;
    lastNfcReadRef.current = null;
    setNfcReading(false);
  }

  async function startNfc() {
    const Reader = (window as Window & { NDEFReader?: NfcInventoryReaderConstructor }).NDEFReader;
    if (!Reader || !window.isSecureContext) { setError("Este móvil o navegador no permite leer NFC directamente. Puedes continuar escaneando los QR."); return; }
    stopNfc(); setError(""); setLastScan(null);
    const controller = new AbortController();
    nfcAbortRef.current = controller;
    try {
      const reader = new Reader();
      reader.addEventListener("readingerror", () => { setError("No se pudo leer la pegatina. Sepárala y vuelve a acercarla."); vibrate([100, 80, 100]); });
      reader.addEventListener("reading", (event) => {
        const rawValue = readNfcValue(event.message.records);
        if (!rawValue) { setError("La pegatina NFC no contiene el enlace de una herramienta."); vibrate([100, 80, 100]); return; }
        const now = Date.now();
        const previousRead = lastNfcReadRef.current;
        if (previousRead && previousRead.value === rawValue && now - previousRead.at < 2500) return;
        lastNfcReadRef.current = { value: rawValue, at: now };
        if (nfcProcessingRef.current) return;
        nfcProcessingRef.current = true;
        void scan(rawValue, "nfc").finally(() => { nfcProcessingRef.current = false; });
      });
      await reader.scan({ signal: controller.signal });
      setNfcReading(true);
    } catch (caught) {
      if (caught instanceof Error && caught.name === "AbortError") return;
      nfcAbortRef.current = null; setNfcReading(false);
      setError(caught instanceof Error && caught.name === "NotAllowedError" ? "No se concedió permiso para leer NFC." : caught instanceof Error ? caught.message : "No se pudo activar el lector NFC.");
    }
  }

  async function finish(markMissing: boolean) {
    if (!active) return;
    const question = pending.length
      ? markMissing ? `Quedan ${pending.length} herramientas sin escanear. Se marcarán como no encontradas las que sigan debiendo estar en el taller; las que se hayan prestado quedarán excluidas. ¿Finalizar?` : `Quedan ${pending.length} herramientas sin escanear. Se guardarán en el resultado, pero no cambiará su estado. ¿Finalizar?`
      : "Todas las herramientas están comprobadas. ¿Finalizar el inventario?";
    if (!window.confirm(question)) return;
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/herramientas-comunes/inventarios/${active.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "finish", markMissing }) });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error || "No se pudo finalizar el inventario.");
      stopNfc(); setLastScan(null); await loadInventory();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "No se pudo finalizar el inventario."); }
    finally { setBusy(false); }
  }

  async function cancel() {
    if (!active || !window.confirm("¿Cancelar este inventario? Las comprobaciones realizadas quedarán en el historial, pero no cambiará ninguna herramienta.")) return;
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/herramientas-comunes/inventarios/${active.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "cancel" }) });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error || "No se pudo cancelar el inventario.");
      stopNfc(); setLastScan(null); await loadInventory();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "No se pudo cancelar el inventario."); }
    finally { setBusy(false); }
  }

  return <><Modal wide title="Modo inventario" subtitle={active ? `Inventario #${active.id} · iniciado por ${active.creado_por}` : "Comprobación física de herramientas"} onClose={onClose}><div className="space-y-4">
    {loading ? <Loading /> : error && !active ? <div className="space-y-3"><Notice tone="red">{error}</Notice><button onClick={() => void loadInventory()} className="min-h-12 w-full rounded-xl border border-zinc-700 font-black text-zinc-200">Reintentar</button></div> : active ? <>
      <div className="grid grid-cols-3 gap-2"><IdentificationCount label="Esperadas" value={active.total_esperadas} tone="zinc" /><IdentificationCount label="Presentes" value={present.length} tone="green" /><IdentificationCount label="Pendientes" value={pending.length} tone={pending.length ? "fuchsia" : "green"} /></div>
      <div className="rounded-2xl border border-zinc-700 bg-zinc-950/60 p-3"><div className="mb-2 flex items-center justify-between text-xs font-black"><span className="text-zinc-400">Progreso</span><span className="text-emerald-300">{progress}%</span></div><div className="h-3 overflow-hidden rounded-full bg-zinc-800"><div className="h-full rounded-full bg-emerald-400 transition-all" style={{ width: `${progress}%` }} /></div></div>
      {error && <div role="alert"><Notice tone="red">{error}</Notice></div>}
      {lastScan && <div role="status" className="flex items-center gap-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-3">{lastScan.foto_url ? <img src={lastScan.foto_url} alt="" className="h-14 w-14 rounded-xl object-cover" /> : <CheckCircle2 className="ml-2 shrink-0 text-emerald-300" size={30} />}<div className="min-w-0"><p className="text-xs font-black text-emerald-300">COMPROBADA</p><p className="font-black text-white">{lastScan.nombre}</p><p className="text-xs text-zinc-400">{lastScan.codigo} · {lastScan.ubicacion_esperada}</p></div></div>}
      {nfcReading && <div role="status" className="flex items-center gap-3 rounded-2xl border border-fuchsia-400/35 bg-fuchsia-500/10 p-4"><span className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-fuchsia-400 text-zinc-950"><span className="absolute inset-0 animate-ping rounded-full bg-fuchsia-400/30" /><Nfc className="relative" size={24} /></span><div><p className="font-black text-fuchsia-100">Lector NFC activo</p><p className="text-xs leading-5 text-fuchsia-200/70">Acerca una herramienta, espera la vibración y continúa con la siguiente.</p></div></div>}
      <div className={nfcSupported ? "grid grid-cols-2 gap-2" : "grid"}><button disabled={busy} onClick={() => setScannerOpen(true)} className="flex min-h-16 items-center justify-center gap-2 rounded-2xl bg-emerald-400 px-3 font-black text-zinc-950 disabled:opacity-50">{busy ? <Loader2 className="animate-spin" /> : <ScanLine />} Escanear QR</button>{nfcSupported && <button disabled={busy} onClick={() => nfcReading ? stopNfc() : void startNfc()} className={`flex min-h-16 items-center justify-center gap-2 rounded-2xl border px-3 font-black ${nfcReading ? "border-red-500/35 bg-red-500/10 text-red-200" : "border-fuchsia-500/40 bg-fuchsia-500/10 text-fuchsia-100"}`}><Nfc />{nfcReading ? "Detener NFC" : "Leer por NFC"}</button>}</div>
      {!nfcSupported && <p className="rounded-xl border border-zinc-800 bg-zinc-950/40 px-3 py-2 text-center text-xs leading-5 text-zinc-500">La lectura NFC directa no está disponible en este móvil o navegador. El inventario por QR sigue funcionando.</p>}
      <div className="grid grid-cols-3 rounded-xl border border-zinc-700 bg-zinc-950 p-1" role="tablist"><InventoryFilter active={filter === "pending"} onClick={() => setFilter("pending")}>Pendientes</InventoryFilter><InventoryFilter active={filter === "present"} onClick={() => setFilter("present")}>Presentes</InventoryFilter><InventoryFilter active={filter === "all"} onClick={() => setFilter("all")}>Todas</InventoryFilter></div>
      <div className="max-h-[35dvh] space-y-2 overflow-y-auto pr-1">{shown.length ? shown.map((item) => <InventoryItem key={item.herramienta_id} item={item} />) : <div className="rounded-2xl border border-dashed border-zinc-700 px-4 py-10 text-center text-sm font-bold text-zinc-500">{filter === "pending" ? "No queda ninguna herramienta pendiente." : "Todavía no hay herramientas en esta lista."}</div>}</div>
      <div className="space-y-2 border-t border-zinc-800 pt-4"><button disabled={busy} onClick={() => void finish(true)} className={`min-h-14 w-full rounded-xl px-4 font-black disabled:opacity-50 ${pending.length ? "bg-amber-400 text-zinc-950" : "bg-emerald-400 text-zinc-950"}`}>{pending.length ? `Finalizar · ${pending.length} no encontradas` : "Finalizar inventario completo"}</button><details><summary className="min-h-10 cursor-pointer list-none py-2 text-center text-xs font-bold text-zinc-500">Otras opciones</summary><div className="grid grid-cols-2 gap-2"><button disabled={busy} onClick={() => void finish(false)} className="min-h-12 rounded-xl border border-zinc-700 px-2 text-xs font-bold text-zinc-300">Finalizar sin cambiar estados</button><button disabled={busy} onClick={() => void cancel()} className="min-h-12 rounded-xl border border-red-500/25 px-2 text-xs font-bold text-red-300">Cancelar inventario</button></div></details></div>
    </> : <>
      <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/10 p-5"><ClipboardCheck className="mb-3 text-emerald-300" size={38} /><h3 className="text-lg font-black text-white">Recorre el taller con el móvil</h3><p className="mt-2 text-sm leading-6 text-emerald-100/70">Lee la pegatina NFC o escanea el QR de cada herramienta. Las prestadas y archivadas no entran en el recuento. Puedes cerrar la pantalla y continuar después.</p></div>
      <button disabled={busy} onClick={() => void start()} className="flex min-h-16 w-full items-center justify-center gap-3 rounded-2xl bg-emerald-400 text-lg font-black text-zinc-950 disabled:opacity-50">{busy ? <Loader2 className="animate-spin" /> : <ClipboardCheck />} Iniciar inventario</button>
      {data.inventories.length > 0 && <section><h3 className="mb-2 px-1 text-xs font-black uppercase tracking-wide text-zinc-500">Últimos inventarios</h3><div className="space-y-2">{data.inventories.filter((inventory) => inventory.estado !== "abierto").map((inventory) => <div key={inventory.id} className="flex items-center justify-between gap-3 rounded-xl border border-zinc-800 bg-zinc-950/50 p-3"><div><p className="font-black text-white">Inventario #{inventory.id}</p><p className="text-xs text-zinc-500">{formatDate(inventory.iniciado_at)} · {inventory.creado_por}</p></div><div className="text-right"><p className={`text-sm font-black ${inventory.estado === "cancelado" ? "text-zinc-500" : inventory.total_no_encontradas ? "text-amber-300" : "text-emerald-300"}`}>{inventory.estado === "cancelado" ? "Cancelado" : `${inventory.total_presentes}/${Math.max(0, inventory.total_esperadas - (inventory.total_excluidas || 0))} presentes`}</p>{inventory.estado === "finalizado" && <p className="text-xs text-zinc-500">{inventory.total_no_encontradas} no encontradas{inventory.total_excluidas ? ` · ${inventory.total_excluidas} prestadas` : ""}</p>}</div></div>)}</div></section>}
    </>}
  </div></Modal>{scannerOpen && <BarcodeScanner title="Inventario de herramientas" description="Escanea el QR pegado en la herramienta que tienes delante." manualPlaceholder="Código de herramienta" manualHint="También puedes escribir el código visible de la herramienta." onScan={(value) => void scan(value)} onClose={() => setScannerOpen(false)} />}</>;
}

function InventoryFilter({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return <button type="button" role="tab" aria-selected={active} onClick={onClick} className={`min-h-11 rounded-lg px-1 text-xs font-black ${active ? "bg-emerald-400 text-zinc-950" : "text-zinc-500"}`}>{children}</button>;
}

function InventoryItem({ item }: { item: InventarioHerramientaItem }) {
  const done = item.resultado === "presente";
  return <div className={`flex items-center gap-3 rounded-xl border p-3 ${done ? "border-emerald-500/20 bg-emerald-500/5" : "border-zinc-800 bg-zinc-950/50"}`}>{item.foto_url ? <img src={item.foto_url} alt={`Foto de ${item.nombre}`} loading="lazy" className="h-12 w-12 shrink-0 rounded-lg object-cover" /> : <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-zinc-900 text-zinc-600"><Wrench size={21} /></span>}<div className="min-w-0 flex-1"><p className="font-mono text-[10px] font-black text-cyan-300">{item.codigo}</p><p className="font-black leading-tight text-white">{item.nombre}</p><p className="mt-1 truncate text-xs text-zinc-500">{item.ubicacion_esperada}</p></div>{done ? <CheckCircle2 className="shrink-0 text-emerald-300" size={22} /> : <Clock3 className="shrink-0 text-amber-300" size={21} />}</div>;
}

function readNfcValue(records: NfcInventoryRecord[]) {
  for (const record of records) {
    if (!record.data) continue;
    try {
      const value = new TextDecoder(record.encoding || "utf-8").decode(record.data).trim();
      if (value) return value;
    } catch { /* Probamos el siguiente registro de la pegatina. */ }
  }
  return "";
}

function vibrate(pattern: number | number[]) {
  try { navigator.vibrate?.(pattern); } catch { /* La vibración es una ayuda opcional. */ }
}

type MobileTab = "buscar" | "lista" | "prestamos" | "plano" | "mas";
function MobileBottomNav({ active, loaned, missing, onChange }: { active: MobileTab; loaned: number; missing: number; onChange: (tab: MobileTab) => void }) {
  return <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-zinc-700 bg-zinc-950/95 px-1 pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_30px_rgba(0,0,0,0.45)] backdrop-blur sm:hidden"><div className="mx-auto grid max-w-lg grid-cols-5"><BottomNavButton active={active === "lista"} label="Lista" icon={<List />} onClick={() => onChange("lista")} /><BottomNavButton active={active === "prestamos"} label="Prestadas" icon={<UserRound />} badge={loaned} onClick={() => onChange("prestamos")} /><BottomNavButton prominent active={active === "buscar"} label="Buscar" icon={<Search />} onClick={() => onChange("buscar")} /><BottomNavButton active={active === "plano"} label="Plano" icon={<LayoutGrid />} onClick={() => onChange("plano")} /><BottomNavButton active={active === "mas"} label="Más" icon={<MoreHorizontal />} badge={missing} badgeTone="red" onClick={() => onChange("mas")} /></div></nav>;
}
function BottomNavButton({ active, label, icon, badge, badgeTone = "amber", onClick, prominent = false }: { active: boolean; label: string; icon: ReactNode; badge?: number; badgeTone?: "amber" | "red"; onClick: () => void; prominent?: boolean }) { if (prominent) return <button onClick={onClick} className="relative flex min-h-16 flex-col items-center justify-end gap-0.5 pb-1 text-[11px] font-black text-cyan-200"><span className={`absolute -top-7 flex h-16 w-16 items-center justify-center rounded-full border-4 border-zinc-950 shadow-[0_5px_20px_rgba(34,211,238,0.35)] [&>svg]:h-7 [&>svg]:w-7 ${active ? "bg-cyan-300 text-zinc-950 ring-4 ring-cyan-400/20" : "bg-cyan-500 text-zinc-950"}`}>{icon}</span>{label}</button>; return <button onClick={onClick} className={`relative flex min-h-16 flex-col items-center justify-center gap-1 rounded-xl text-[10px] font-black ${active ? "text-cyan-300" : "text-zinc-500"}`}><span className={`[&>svg]:h-5 [&>svg]:w-5 ${active ? "rounded-xl bg-cyan-500/15 p-1 [&>svg]:h-6 [&>svg]:w-6" : ""}`}>{icon}</span>{label}{Boolean(badge) && <span className={`absolute right-2 top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px] text-zinc-950 ${badgeTone === "red" ? "bg-red-400" : "bg-amber-400"}`}>{badge}</span>}</button>; }
function Loading() { return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-cyan-300" size={36} /></div>; }
function SearchPrompt() { return <div className="rounded-2xl border border-dashed border-cyan-500/20 bg-cyan-500/5 px-5 py-16 text-center"><Search className="mx-auto mb-4 text-cyan-500/50" size={48} /><h2 className="font-black text-white">Busca una herramienta</h2><p className="mx-auto mt-2 max-w-xs text-sm leading-6 text-zinc-500">Escribe su nombre, código o marca y te mostraremos exactamente dónde está.</p></div>; }

function SearchLocationResults({ tools, shelves, onTool }: { tools: HerramientaComun[]; shelves: EstanteriaHerramientas[]; onTool: (tool: HerramientaComun) => void }) {
  return <div className="space-y-4"><section className="grid gap-3 sm:grid-cols-2">{tools.map((tool) => <button type="button" key={tool.id} onClick={() => onTool(tool)} aria-label={`Abrir ${tool.nombre}`} className={`rounded-xl border p-4 text-left transition active:scale-[0.99] ${tool.estado === "prestada" ? "border-amber-500/30 bg-amber-500/10" : "border-cyan-500/30 bg-cyan-500/10"}`}>
    <div className="flex flex-wrap items-start justify-between gap-2">
      <div className="min-w-0 flex-1"><p className="font-mono text-[10px] font-black text-cyan-300">{tool.codigo}</p><h2 className="text-lg font-black leading-tight text-white">{tool.nombre}</h2></div>
      <span className="flex flex-wrap justify-end gap-2"><ToolStatusBadge tool={tool} /><ToolModeBadge tool={tool} /></span>
    </div>
    <div className="mt-3 grid grid-cols-[minmax(0,1fr)_7rem] items-stretch gap-3">
      <div className="min-w-0">
        {tool.estado === "prestada" ? <p className="text-sm font-bold text-amber-100"><UserRound className="mr-1 inline" size={16} /> La tiene {tool.empleado_actual}{tool.vehiculo_actual ? ` · ${tool.vehiculo_actual}` : ""}</p> : <p className="flex items-start gap-2 text-sm font-black text-cyan-100"><MapPin className="mt-0.5 shrink-0" size={17} />{location(tool)}</p>}
        {tool.espacio_ocupado && <p className="mt-2 text-sm font-bold text-violet-200">Ocupa: {tool.espacio_ocupado}</p>}
        <span className="mt-4 block text-xs font-black text-white/70">Pulsa para abrir y actuar</span>
      </div>
      {tool.foto_url ? <img src={tool.foto_url} alt={`Foto de ${tool.nombre}`} loading="lazy" decoding="async" width={224} height={224} className="aspect-square h-28 w-28 self-end rounded-xl border border-white/15 bg-zinc-950 object-cover shadow-md shadow-black/30" /> : <span className="flex aspect-square h-28 w-28 flex-col items-center justify-center gap-1 self-end rounded-xl border border-dashed border-zinc-600 bg-zinc-950/60 text-zinc-500"><Wrench size={27} /><span className="text-[10px] font-bold">Sin foto</span></span>}
    </div>
  </button>)}</section><ShelfView shelves={shelves} tools={tools} onTool={onTool} highlight /></div>;
}

function ShelfView({ shelves, tools, onTool, highlight = false }: { shelves: EstanteriaHerramientas[]; tools: HerramientaComun[]; onTool: (tool: HerramientaComun) => void; highlight?: boolean }) {
  const [selectedShelfId, setSelectedShelfId] = useState<number | null>(null);
  const visibleShelves = highlight ? shelves.filter((shelf) => tools.some((tool) => tool.estanteria_id === shelf.id)) : shelves;
  const zones = Object.entries(Object.groupBy(visibleShelves, (shelf) => shelf.zona));
  if (highlight) return <div className="space-y-8">{zones.map(([zone, zoneShelves]) => <section key={zone}><div className="mb-4 flex items-center gap-3"><span className="rounded-xl bg-cyan-500/10 p-2 text-cyan-300"><MapPin size={20} /></span><div><h2 className="text-xl font-black">{zone}</h2><p className="text-xs text-zinc-500">Ubicación encontrada · pulsa la herramienta para abrirla</p></div></div><div className="grid items-start gap-5 md:grid-cols-2 2xl:grid-cols-4">{zoneShelves?.map((shelf) => <VisualShelf key={shelf.id} shelf={shelf} tools={tools.filter((tool) => tool.estanteria_id === shelf.id)} onTool={onTool} highlight />)}</div></section>)}</div>;
  const selectedShelf = shelves.find((shelf) => shelf.id === selectedShelfId) || null;
  const selectedTools = selectedShelf ? tools.filter((tool) => tool.estanteria_id === selectedShelf.id) : [];
  return <div className="space-y-7">
    <header className="flex items-start gap-3 rounded-2xl border border-cyan-500/20 bg-cyan-500/5 p-4"><span className="rounded-xl bg-cyan-500/10 p-2.5 text-cyan-300"><LayoutGrid size={22} /></span><div><h2 className="font-black text-white">Plano de estanterías</h2><p className="mt-1 text-sm leading-5 text-zinc-500">Pulsa una miniatura para ampliarla y ver sus herramientas.</p></div></header>
    {zones.map(([zone, zoneShelves]) => <section key={zone}><div className="mb-3 flex items-center justify-between gap-3 px-1"><div><h2 className="text-lg font-black text-white">{zone}</h2><p className="text-xs text-zinc-500">{zoneShelves?.length || 0} estantería{zoneShelves?.length === 1 ? "" : "s"}</p></div><MapPin className="text-cyan-400" size={20} /></div><div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">{zoneShelves?.map((shelf) => <MiniShelf key={shelf.id} shelf={shelf} tools={tools.filter((tool) => tool.estanteria_id === shelf.id)} onClick={() => setSelectedShelfId(shelf.id)} />)}</div></section>)}
    {selectedShelf && <Modal wide title={`${selectedShelf.codigo} · ${selectedShelf.nombre}`} subtitle={`${selectedShelf.zona} · ${selectedTools.length} herramienta${selectedTools.length === 1 ? "" : "s"}`} onClose={() => setSelectedShelfId(null)}><div className="space-y-3"><p className="rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-3 text-sm text-cyan-100">Pulsa una herramienta dentro de la estantería para ver su ficha y actuar.</p><VisualShelf shelf={selectedShelf} tools={selectedTools} onTool={(tool) => { setSelectedShelfId(null); onTool(tool); }} /></div></Modal>}
  </div>;
}

function MiniShelf({ shelf, tools, onClick }: { shelf: EstanteriaHerramientas; tools: HerramientaComun[]; onClick: () => void }) {
  const rows = shelf.configuracion?.filas?.length ? shelf.configuracion.filas : fallbackRows(shelf.niveles);
  return <button type="button" onClick={onClick} aria-label={`Ampliar ${shelf.codigo}, ${shelf.nombre}`} className="overflow-hidden rounded-2xl border border-zinc-700 bg-zinc-900 text-left shadow-lg shadow-black/20 transition active:scale-[0.98] active:border-cyan-400">
    <header className="flex min-h-16 items-start justify-between gap-2 border-b border-zinc-700 bg-zinc-950/70 p-3"><div className="min-w-0"><p className="font-mono text-[10px] font-black text-cyan-300">{shelf.codigo}</p><h3 className="truncate text-sm font-black text-white">{shelf.nombre}</h3></div><span className="shrink-0 rounded-full bg-zinc-800 px-2 py-1 text-[10px] font-black text-zinc-300">{tools.length}</span></header>
    <div className="p-2"><div className="flex h-28 flex-col overflow-hidden border-x-[3px] border-b-[3px] border-zinc-600 bg-zinc-950">{rows.map((row) => <div key={row.nivel} className={`grid min-h-0 basis-0 border-b-[3px] border-zinc-600 last:border-b-0 ${row.tipo === "colgador" ? "bg-zinc-800/45" : "bg-zinc-900/60"}`} style={{ flexGrow: Math.max(1, row.altura), gridTemplateColumns: `repeat(${row.columnas}, minmax(0, 1fr))` }}>{Array.from({ length: row.columnas }, (_, index) => `C${index + 1}`).map((position) => { const cellTools = tools.filter((tool) => tool.nivel === row.nivel && normalizePosition(tool.posicion) === position); const cellTone = cellTools.some((tool) => tool.estado === "perdida" || tool.estado === "reparacion") ? "bg-red-400/70" : cellTools.some((tool) => tool.estado === "prestada") ? "bg-amber-400/70" : cellTools.length ? "bg-cyan-400/70" : ""; return <span key={position} className={`flex min-w-0 items-center justify-center border-r border-zinc-700 last:border-r-0 ${cellTone}`}>{cellTools.length > 0 && <span className="text-[9px] font-black text-zinc-950">{cellTools.length}</span>}</span>; })}</div>)}</div></div>
    <footer className="flex min-h-10 items-center justify-center gap-1.5 border-t border-zinc-800 text-xs font-black text-cyan-300"><Search size={14} /> Ampliar</footer>
  </button>;
}

function VisualShelf({ shelf, tools, onTool, highlight = false }: { shelf: EstanteriaHerramientas; tools: HerramientaComun[]; onTool: (tool: HerramientaComun) => void; highlight?: boolean }) {
  const rows = shelf.configuracion?.filas?.length ? shelf.configuracion.filas : fallbackRows(shelf.niveles);
  return <article className={`overflow-hidden rounded-2xl border bg-zinc-900 shadow-xl ${highlight ? "border-cyan-300 ring-4 ring-cyan-400/20" : "border-zinc-700"}`}><header className="flex items-start justify-between border-b border-zinc-700 bg-zinc-950/70 p-4"><div><p className="font-mono text-xs font-black text-cyan-300">{shelf.codigo}</p><h3 className="font-black text-white">{shelf.nombre}</h3></div><span className="rounded-full bg-zinc-800 px-2.5 py-1 text-[10px] font-bold text-zinc-400">{tools.length} herramientas</span></header><div className="border-x-4 border-b-4 border-zinc-600 bg-zinc-950 p-1">{rows.map((row) => <div key={row.nivel} className={`relative grid border-b-4 border-zinc-600 last:border-b-0 ${row.tipo === "colgador" ? "bg-amber-950/15" : "bg-zinc-900/60"}`} style={{ gridTemplateColumns: `repeat(${row.columnas}, minmax(0, 1fr))`, minHeight: `${Math.max(68, row.altura * 62)}px` }}>{Array.from({ length: row.columnas }, (_, index) => `C${index + 1}`).map((position) => { const cellTools = tools.filter((tool) => tool.nivel === row.nivel && normalizePosition(tool.posicion) === position); return <div key={position} className={`relative flex min-w-0 flex-col gap-1 border-r-2 p-1.5 last:border-r-0 ${highlight && cellTools.length ? "border-cyan-300 bg-cyan-400/10 ring-2 ring-inset ring-cyan-300" : "border-zinc-700"}`}><div className={`flex items-center justify-between gap-1 text-[9px] font-bold uppercase ${highlight && cellTools.length ? "text-cyan-200" : "text-zinc-600"}`}><span>{row.nombre}</span>{row.columnas > 1 && <span>{position}</span>}</div>{row.tipo === "colgador" && !cellTools.length && <div className="flex flex-1 items-center justify-center"><Grip className="text-amber-700/50" size={28} /><span className="sr-only">Zona para colgar</span></div>}{cellTools.map((tool) => <button key={tool.id} onClick={() => onTool(tool)} title={`${tool.nombre} · ${STATUS[tool.estado].label}`} className={`min-w-0 rounded-lg border px-2 py-2 text-left text-[11px] font-bold leading-tight ${STATUS[tool.estado].classes} ${highlight ? "animate-pulse ring-2 ring-white/70" : ""}`}><span className="block truncate">{tool.nombre}</span>{tool.solo_localizacion && <span className="block truncate text-[9px] font-black text-violet-200">Solo localizar</span>}{tool.espacio_ocupado && <span className="block truncate text-[9px] font-normal opacity-75">Ocupa: {tool.espacio_ocupado}</span>}{tool.estado === "prestada" && <span className="block truncate text-[9px] font-normal opacity-75">La tiene {tool.empleado_actual}</span>}</button>)}</div>; })}</div>)}</div><footer className="flex items-center justify-between bg-zinc-950/40 px-4 py-2 text-[10px] text-zinc-500"><span>{rows.length} niveles</span><span>{rows.reduce((sum, row) => sum + row.columnas, 0)} espacios</span></footer></article>;
}

function CreateToolModal({ shelves, categories, requirePhoto, onClose, onCreated }: { shelves: EstanteriaHerramientas[]; categories: string[]; requirePhoto: boolean; onClose: () => void; onCreated: (toolId: number, located: boolean) => void | Promise<void> }) {
  const [saving, setSaving] = useState(false); const [savingText, setSavingText] = useState(""); const [error, setError] = useState(""); const [photo, setPhoto] = useState<File | null>(null); const [preview, setPreview] = useState(""); const [createdId, setCreatedId] = useState<number | null>(null);
  const [assignLocation, setAssignLocation] = useState(false); const [shelfId, setShelfId] = useState(shelves[0]?.id || 0); const [level, setLevel] = useState(shelves[0]?.configuracion?.filas?.[0]?.nivel || 1); const [position, setPosition] = useState("C1");
  const selectedShelf = shelves.find((shelf) => shelf.id === shelfId) || shelves[0]; const selectedRows = selectedShelf?.configuracion?.filas || []; const selectedLevel = selectedRows.some((row) => row.nivel === level) ? level : selectedRows[0]?.nivel || 1; const selectedRow = selectedRows.find((row) => row.nivel === selectedLevel); const selectedPosition = Number(position.slice(1)) <= (selectedRow?.columnas || 1) ? position : "C1";
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);
  function selectPhoto(file?: File) { setError(""); if (!file) return; if (!file.type.startsWith("image/") || file.size > PHOTO_SOURCE_MAX_BYTES) { setError("Selecciona una fotografía válida de hasta 30 MB."); return; } setPhoto(file); setPreview(URL.createObjectURL(file)); }
  async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); if (requirePhoto && !photo) { setError("Haz una foto inicial antes de registrar la herramienta."); return; } setSaving(true); setError(""); const form = new FormData(event.currentTarget); const body = { ...Object.fromEntries(form.entries()), ...(assignLocation && selectedShelf ? { estanteria_id: selectedShelf.id, nivel: selectedLevel, posicion: selectedPosition } : {}) }; try { let toolId = createdId; if (!toolId) { setSavingText("Registrando herramienta..."); const response = await fetch("/api/herramientas-comunes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }); const payload = await response.json() as HerramientaComun & { error?: string }; if (!response.ok) throw new Error(payload.error || "No se pudo registrar."); toolId = payload.id; setCreatedId(toolId); } if (photo) { setSavingText("Preparando fotografía..."); const optimized = await optimizePhoto(photo); setSavingText("Guardando fotografía inicial..."); const photoResponse = await fetch(`/api/herramientas-comunes/${toolId}/foto`, { method: "POST", headers: { "Content-Type": optimized.type || "application/octet-stream", "X-Photo-Name": encodeURIComponent(optimized.name) }, body: optimized }); const photoPayload = await photoResponse.json() as { error?: string }; if (!photoResponse.ok) throw new Error(`La herramienta está registrada, pero falta la foto: ${photoPayload.error || "no se pudo guardar"}. Pulsa de nuevo para reintentar.`); } await onCreated(toolId, assignLocation && Boolean(selectedShelf)); } catch (caught) { setError(caught instanceof Error ? caught.message : "No se pudo registrar."); } finally { setSaving(false); setSavingText(""); } }
  return <Modal title="Registrar herramienta común" subtitle="El código se genera solo y podrás colocarla después con los QR" onClose={onClose}><form onSubmit={submit} className="space-y-4">{error && <Notice tone="red">{error}</Notice>}<section className="space-y-3 rounded-2xl border border-zinc-700 bg-zinc-950/45 p-4"><div><p className="font-black text-white">Ubicación (opcional)</p><p className="mt-1 text-xs leading-5 text-zinc-500">Puedes colocarla ahora o dejarlo pendiente para usar después el QR o el plano.</p></div><div className="grid grid-cols-2 gap-2"><button type="button" disabled={Boolean(createdId)} onClick={() => setAssignLocation(false)} className={`min-h-12 rounded-xl border px-3 text-sm font-black ${!assignLocation ? "border-amber-400 bg-amber-400 text-zinc-950" : "border-zinc-700 text-zinc-400"}`}>Sin ubicación</button><button type="button" disabled={Boolean(createdId) || !shelves.length} onClick={() => setAssignLocation(true)} className={`min-h-12 rounded-xl border px-3 text-sm font-black disabled:opacity-40 ${assignLocation ? "border-cyan-400 bg-cyan-400 text-zinc-950" : "border-zinc-700 text-zinc-400"}`}>Asignar ahora</button></div>{assignLocation && selectedShelf && <div className="grid gap-3 rounded-xl border border-cyan-500/25 bg-cyan-500/5 p-3 sm:grid-cols-3"><Field label="Estantería"><select value={selectedShelf.id} onChange={(event) => { const nextId = Number(event.target.value); const nextShelf = shelves.find((shelf) => shelf.id === nextId); setShelfId(nextId); setLevel(nextShelf?.configuracion?.filas?.[0]?.nivel || 1); setPosition("C1"); }} className="input">{shelves.map((shelf) => <option key={shelf.id} value={shelf.id}>{shelf.zona} · {shelf.codigo}</option>)}</select></Field><Field label="Nivel"><select value={selectedLevel} onChange={(event) => { setLevel(Number(event.target.value)); setPosition("C1"); }} className="input">{selectedRows.map((row) => <option key={row.nivel} value={row.nivel}>{row.nombre}</option>)}</select></Field><Field label="Compartimento"><select value={selectedPosition} onChange={(event) => setPosition(event.target.value)} className="input">{Array.from({ length: selectedRow?.columnas || 1 }, (_, itemIndex) => <option key={itemIndex} value={`C${itemIndex + 1}`}>{selectedRow && selectedRow.columnas > 1 ? `Compartimento ${itemIndex + 1}` : "Espacio completo"}</option>)}</select></Field><p className="sm:col-span-3 text-sm font-bold text-cyan-100"><MapPin className="mr-1 inline" size={16} />{locationName(selectedShelf, selectedLevel, selectedPosition)}</p></div>}</section><div className="grid gap-4 sm:grid-cols-2"><Field label="Nombre *"><input name="nombre" required disabled={Boolean(createdId)} className="input disabled:opacity-50" placeholder="Ej. Maletín de diagnosis" /></Field><CategoryPicker categories={categories} disabled={Boolean(createdId)} /><Field label="Marca"><input name="marca" disabled={Boolean(createdId)} className="input disabled:opacity-50" /></Field><div className="sm:col-span-2"><span className="mb-2 block text-xs font-bold uppercase tracking-wide text-zinc-400">Foto inicial (opcional)</span><div className="grid gap-3 rounded-2xl border border-dashed border-cyan-500/30 bg-cyan-500/5 p-3 sm:grid-cols-[160px_1fr]">{preview ? <div className="relative overflow-hidden rounded-xl border border-cyan-400/40"><img src={preview} alt="Vista previa de la herramienta" className="aspect-square h-full w-full object-cover" /><button type="button" onClick={() => { setPhoto(null); setPreview(""); }} className="absolute right-2 top-2 rounded-lg bg-black/70 p-2 text-white" aria-label="Quitar foto"><X size={16} /></button></div> : <div className="flex aspect-video items-center justify-center rounded-xl bg-zinc-950 text-zinc-700 sm:aspect-square"><Camera size={40} /></div>}<div className="flex flex-col justify-center gap-2"><p className="text-sm font-bold text-cyan-100">Fotografía cómo está antes de empezar a usarla.</p><p className="text-xs leading-5 text-zinc-500">Servirá como referencia del estado y del contenido original.</p><div className="grid grid-cols-2 gap-2"><label className="inline-flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-xl bg-cyan-400 px-3 text-sm font-black text-zinc-950"><input type="file" accept="image/*" capture="environment" className="hidden" onChange={(event) => selectPhoto(event.target.files?.[0])} /><Camera size={18} /> Hacer foto</label><label className="inline-flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-xl border border-zinc-700 px-3 text-sm font-bold text-zinc-300"><input type="file" accept="image/*" className="hidden" onChange={(event) => selectPhoto(event.target.files?.[0])} /><ImagePlus size={18} /> Galería</label></div></div></div></div></div><div className="grid gap-3 sm:grid-cols-2"><label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-violet-500/30 bg-violet-500/10 p-4"><input type="checkbox" name="solo_localizacion" disabled={Boolean(createdId)} className="mt-1 h-5 w-5 accent-violet-400" /><span><span className="block font-black text-violet-100">Solo localizar</span><span className="mt-1 block text-xs leading-5 text-violet-200/65">Se verá en el plano, pero nadie podrá retirarlo.</span></span></label><Field label="Espacio que ocupa"><input name="espacio_ocupado" disabled={Boolean(createdId)} className="input disabled:opacity-50" placeholder="Ej. caja azul, media balda..." /></Field></div><Field label="Descripción"><textarea name="descripcion" rows={3} disabled={Boolean(createdId)} className="input resize-none disabled:opacity-50" placeholder="Contenido del maletín o indicaciones de uso" /></Field><button disabled={saving} className="flex min-h-14 w-full items-center justify-center gap-2 rounded-xl bg-cyan-400 py-3 font-black text-zinc-950 disabled:opacity-50">{saving ? <Loader2 className="animate-spin" /> : createdId ? <Camera /> : <PackagePlus />} {savingText || (createdId ? "Reintentar guardar foto" : "Registrar herramienta")}</button></form></Modal>;
}

function EditToolModal({ tool, categories, onClose, onSaved }: { tool: HerramientaComun; categories: string[]; onClose: () => void; onSaved: () => void | Promise<void> }) {
  const [photo, setPhoto] = useState<File | null>(null); const [preview, setPreview] = useState(tool.foto_url || ""); const [localPreview, setLocalPreview] = useState(""); const [saving, setSaving] = useState(false); const [savingText, setSavingText] = useState(""); const [error, setError] = useState("");
  useEffect(() => () => { if (localPreview) URL.revokeObjectURL(localPreview); }, [localPreview]);
  function selectPhoto(file?: File) { setError(""); if (!file) return; if (!file.type.startsWith("image/") || file.size > PHOTO_SOURCE_MAX_BYTES) { setError("Selecciona una fotografía válida de hasta 30 MB."); return; } const objectUrl = URL.createObjectURL(file); setPhoto(file); setLocalPreview(objectUrl); setPreview(objectUrl); }
  async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setSaving(true); setError(""); const body = { ...Object.fromEntries(new FormData(event.currentTarget).entries()), action: "editar" }; try { setSavingText("Guardando cambios..."); const response = await fetch(`/api/herramientas-comunes/${tool.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }); const payload = await response.json() as { error?: string }; if (!response.ok) throw new Error(payload.error || "No se pudo editar la herramienta."); if (photo) { setSavingText("Preparando nueva fotografía..."); const optimized = await optimizePhoto(photo); setSavingText("Sustituyendo fotografía..."); const photoResponse = await fetch(`/api/herramientas-comunes/${tool.id}/foto`, { method: "POST", headers: { "Content-Type": optimized.type || "application/octet-stream", "X-Photo-Name": encodeURIComponent(optimized.name) }, body: optimized }); const photoPayload = await photoResponse.json() as { error?: string }; if (!photoResponse.ok) throw new Error(photoPayload.error || "Los datos se guardaron, pero no se pudo sustituir la fotografía."); } await onSaved(); } catch (caught) { setError(caught instanceof Error ? caught.message : "No se pudo editar la herramienta."); } finally { setSaving(false); setSavingText(""); } }
  return <Modal title="Editar herramienta" subtitle={`${tool.codigo} · ${tool.nombre}`} onClose={onClose}><form onSubmit={submit} className="space-y-4">{error && <Notice tone="red">{error}</Notice>}<div className="rounded-xl border border-zinc-700 bg-zinc-950/50 p-3 text-sm text-zinc-400"><strong className="text-white">Código automático:</strong> {tool.codigo}<br /><span className="text-xs">El código y la ubicación se gestionan con las etiquetas QR.</span></div><div className="grid gap-4 sm:grid-cols-2"><Field label="Nombre *"><input name="nombre" defaultValue={tool.nombre} required className="input" /></Field><CategoryPicker categories={categories} defaultValue={tool.categoria || ""} /><Field label="Marca"><input name="marca" defaultValue={tool.marca || ""} className="input" /></Field><div><span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-zinc-400">Fotografía</span><div className="flex items-center gap-3">{preview ? <img src={preview} alt="Fotografía de la herramienta" className="h-20 w-20 rounded-xl border border-zinc-700 object-cover" /> : <span className="flex h-20 w-20 items-center justify-center rounded-xl bg-zinc-950 text-zinc-700"><Camera /></span>}<label className="inline-flex min-h-12 cursor-pointer items-center gap-2 rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-3 text-sm font-bold text-cyan-200"><input type="file" accept="image/*" capture="environment" className="hidden" onChange={(event) => selectPhoto(event.target.files?.[0])} /><Camera size={17} /> Cambiar foto</label></div></div></div><div className="grid gap-3 sm:grid-cols-2"><label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-violet-500/30 bg-violet-500/10 p-4"><input type="checkbox" name="solo_localizacion" defaultChecked={tool.solo_localizacion} className="mt-1 h-5 w-5 accent-violet-400" /><span><span className="block font-black text-violet-100">Solo localizar</span><span className="mt-1 block text-xs leading-5 text-violet-200/65">Se verá en el plano, pero nadie podrá retirarlo.</span></span></label><Field label="Espacio que ocupa"><input name="espacio_ocupado" defaultValue={tool.espacio_ocupado || ""} className="input" placeholder="Ej. caja azul, media balda..." /></Field></div><Field label="Descripción"><textarea name="descripcion" rows={3} defaultValue={tool.descripcion || ""} className="input resize-none" /></Field><button disabled={saving} className="flex min-h-14 w-full items-center justify-center gap-2 rounded-xl bg-cyan-400 py-3 font-black text-zinc-950 disabled:opacity-50">{saving ? <Loader2 className="animate-spin" /> : <Edit3 />} {savingText || "Guardar cambios"}</button></form></Modal>;
}

function CategoryPicker({ categories, defaultValue = "", disabled = false }: { categories: string[]; defaultValue?: string; disabled?: boolean }) {
  const existingValue = categories.find((category) => normalize(category) === normalize(defaultValue.trim()));
  const [selection, setSelection] = useState(existingValue || (defaultValue.trim() ? "__new__" : ""));
  const [customValue, setCustomValue] = useState(existingValue ? "" : defaultValue);
  const legacyMultiple = defaultValue.includes(",") && selection === "__new__";
  return <div>
    <label><span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-zinc-400">Categoría</span><select disabled={disabled} value={selection} onChange={(event) => { setSelection(event.target.value); if (event.target.value === "__new__" && existingValue) setCustomValue(""); }} className="input disabled:opacity-50"><option value="">Sin categoría</option>{categories.map((category) => <option key={category} value={category}>{category}</option>)}<option value="__new__">＋ Crear nueva categoría</option></select></label>
    {selection === "__new__" ? <label className="mt-2 block"><span className="sr-only">Nombre de la nueva categoría</span><input name="categoria" disabled={disabled} required value={customValue} onChange={(event) => setCustomValue(event.target.value)} onBlur={() => { const match = categories.find((category) => normalize(category) === normalize(customValue)); if (match) { setSelection(match); setCustomValue(""); } }} pattern="[^,]+" title="Escribe una sola categoría, sin comas" className="input disabled:opacity-50" placeholder="Nombre de la nueva categoría" /><span className="mt-1.5 block text-xs text-zinc-500">Escribe una sola categoría, sin comas.</span></label> : <input type="hidden" name="categoria" value={selection} disabled={disabled} readOnly />}
    {legacyMultiple && <p className="mt-2 rounded-lg border border-amber-500/25 bg-amber-500/10 p-2 text-xs font-bold leading-5 text-amber-200">Esta herramienta tiene varias categorías separadas por comas. Elige una categoría existente o escribe una sola antes de guardar.</p>}
  </div>;
}

type ScannedToolModalProps = {
  tool: HerramientaComun;
  busy: boolean;
  canManage: boolean;
  canReportMissing: boolean;
  onClose: () => void;
  onLoan: () => void;
  onReturn: () => void;
  onPlace: () => void;
  onChoosePlan: () => void;
  onShowLocation: () => void;
  onHistory: () => void;
  onMove: () => void;
  onNfc: () => void;
  onReportMissing: () => void;
  onFound: () => void;
};

function ScannedToolModal({ tool, busy, canManage, canReportMissing, onClose, onLoan, onReturn, onPlace, onChoosePlan, onShowLocation, onHistory, onMove, onNfc, onReportMissing, onFound }: ScannedToolModalProps) {
  const located = Boolean(tool.estanteria_id && tool.nivel && tool.posicion);
  const canMove = tool.estado !== "prestada";
  return <Modal title="Ficha de herramienta" subtitle={`${tool.codigo} · ${tool.nombre}`} onClose={onClose}><div className="space-y-4">
    <div className="flex items-start gap-4 rounded-2xl border border-zinc-700 bg-zinc-950/50 p-4">
      {tool.foto_url ? <img src={tool.foto_url} alt={`Foto de ${tool.nombre}`} className="h-24 w-24 shrink-0 rounded-xl object-cover" /> : <span className="flex h-24 w-24 shrink-0 items-center justify-center rounded-xl bg-zinc-900 text-zinc-600"><Wrench size={36} /></span>}
      <div className="min-w-0"><span className="flex flex-wrap items-center gap-2"><ToolStatusBadge tool={tool} /><ToolModeBadge tool={tool} /></span><h3 className="mt-3 text-xl font-black text-white">{tool.nombre}</h3>{tool.estado === "prestada" ? <p className="mt-2 font-bold text-amber-200">La tiene {tool.empleado_actual}{tool.vehiculo_actual ? ` · ${tool.vehiculo_actual}` : ""}</p> : <p className={`mt-2 text-sm font-bold ${located ? "text-cyan-100" : "text-red-200"}`}>{location(tool)}</p>}{tool.espacio_ocupado && <p className="mt-2 text-sm font-bold text-violet-200">Ocupa: {tool.espacio_ocupado}</p>}</div>
    </div>

    <section className="rounded-2xl border border-zinc-700 bg-zinc-950/35 p-3">
      <p className="mb-2 px-1 text-xs font-black uppercase tracking-wide text-zinc-500">Consultar y gestionar</p>
      <div className="grid grid-cols-2 gap-2">
        <button disabled={!located} onClick={onShowLocation} className="flex min-h-14 items-center justify-center gap-2 rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-2 text-sm font-black text-cyan-100 disabled:opacity-35"><MapPin size={18} /> Ubicación</button>
        <button onClick={onHistory} className="flex min-h-14 items-center justify-center gap-2 rounded-xl border border-zinc-700 bg-zinc-800/60 px-2 text-sm font-black text-zinc-100"><History size={18} /> Historial</button>
        {canManage && <button disabled={!canMove} onClick={onMove} className="flex min-h-14 items-center justify-center gap-2 rounded-xl border border-violet-500/30 bg-violet-500/10 px-2 text-sm font-black text-violet-100 disabled:opacity-35"><LayoutGrid size={18} /> Mover</button>}
        {canManage && <button disabled={!tool.qr_token} onClick={onNfc} className="flex min-h-14 items-center justify-center gap-2 rounded-xl border border-fuchsia-500/30 bg-fuchsia-500/10 px-2 text-sm font-black text-fuchsia-100 disabled:opacity-35"><Nfc size={18} /> Grabar NFC</button>}
        {tool.estado === "perdida" ? <button disabled={busy} onClick={onFound} className="flex min-h-14 items-center justify-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-2 text-sm font-black text-emerald-100 disabled:opacity-40"><CheckCircle2 size={18} /> Ya encontrada</button> : <button disabled={!canReportMissing || tool.estado !== "disponible" || !located} onClick={onReportMissing} className="flex min-h-14 items-center justify-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-2 text-sm font-black text-red-100 disabled:opacity-35"><AlertTriangle size={18} /> No está aquí</button>}
      </div>
    </section>

    {!located && <div className="space-y-3"><p className="text-center text-sm font-bold text-zinc-400">Esta herramienta aún no tiene ubicación. Elige dónde guardarla.</p><button onClick={onPlace} className="flex min-h-16 w-full items-center justify-center gap-3 rounded-2xl bg-emerald-400 text-lg font-black text-zinc-950"><ScanLine /> Escanear QR del hueco</button><button onClick={onChoosePlan} className="flex min-h-16 w-full items-center justify-center gap-3 rounded-2xl border border-cyan-500/40 bg-cyan-500/10 text-lg font-black text-cyan-100"><LayoutGrid /> Elegir en el plano</button></div>}
    {tool.solo_localizacion && located && <div className="rounded-2xl border border-violet-500/30 bg-violet-500/10 p-4 text-sm font-bold text-violet-100">Material de solo localización · permanece en este sitio y no se puede retirar.</div>}
    {tool.estado === "disponible" && located && !tool.solo_localizacion && <button onClick={onLoan} className="flex min-h-16 w-full items-center justify-center gap-3 rounded-2xl bg-cyan-400 text-lg font-black text-zinc-950"><Wrench /> Retirar herramienta</button>}
    {tool.estado === "prestada" && <button disabled={busy} onClick={onReturn} className="flex min-h-16 w-full items-center justify-center gap-3 rounded-2xl bg-emerald-400 text-lg font-black text-zinc-950 disabled:opacity-50"><ScanLine /> Devolver escaneando su hueco</button>}
    {tool.estado !== "disponible" && tool.estado !== "prestada" && <Notice tone="red">Esta herramienta está marcada como {STATUS[tool.estado].label.toLocaleLowerCase("es")}.</Notice>}
  </div></Modal>;
}

function ReportMissingModal({ tool, busy, onClose, onConfirm }: { tool: HerramientaComun; busy: boolean; onClose: () => void; onConfirm: () => void }) {
  return <Modal title="Reportar herramienta ausente" subtitle={`${tool.codigo} · ${tool.nombre}`} onClose={onClose}><div className="space-y-4"><Notice tone="red"><strong className="block text-base">¿No está en el lugar indicado?</strong><span className="mt-1 block leading-6">Se marcará como no encontrada, quedará registrado en el historial y no podrá retirarse hasta que alguien confirme que ha aparecido.</span></Notice><div className="rounded-xl border border-zinc-700 bg-zinc-950/50 p-4"><p className="text-xs font-black uppercase tracking-wide text-zinc-500">Ubicación que se va a reportar</p><p className="mt-1 font-black text-white"><MapPin className="mr-1 inline text-cyan-300" size={17} />{location(tool)}</p></div><div className="grid grid-cols-2 gap-2"><button disabled={busy} onClick={onClose} className="min-h-14 rounded-xl border border-zinc-700 font-bold text-zinc-300">Cancelar</button><button disabled={busy} onClick={onConfirm} className="flex min-h-14 items-center justify-center gap-2 rounded-xl bg-red-500 px-3 font-black text-white disabled:opacity-50">{busy ? <Loader2 className="animate-spin" size={19} /> : <AlertTriangle size={19} />} Confirmar reporte</button></div></div></Modal>;
}

type NfcWriter = { write: (message: { records: Array<{ recordType: "url"; data: string }> }) => Promise<void> };
type NfcWriterConstructor = new () => NfcWriter;

function NfcToolModal({ tool, onClose, onStatus }: { tool: HerramientaComun; onClose: () => void; onStatus: (completed: boolean) => Promise<unknown> }) {
  const [writing, setWriting] = useState(false);
  const [savingStatus, setSavingStatus] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const path = tool.qr_token ? buildToolQrPath(tool.qr_token, tool.codigo) : "";
  const url = typeof window === "undefined" || !path ? path : `${window.location.origin}${path}`;
  const directSupported = typeof window !== "undefined" && Boolean((window as Window & { NDEFReader?: NfcWriterConstructor }).NDEFReader) && window.isSecureContext;
  const localOnly = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/i.test(url);
  async function writeTag() {
    setError(""); setSuccess(""); setCopied(false);
    const Reader = (window as Window & { NDEFReader?: NfcWriterConstructor }).NDEFReader;
    if (!Reader || !window.isSecureContext) { setError("Este navegador no permite grabar NFC directamente. Copia el enlace y grábalo con NFC Tools."); return; }
    setWriting(true);
    try {
      const writer = new Reader();
      await writer.write({ records: [{ recordType: "url", data: url }] });
      await onStatus(true);
      setSuccess("Pegatina grabada correctamente. Sepárala del móvil y vuelve a acercarla para comprobarla.");
    } catch (caught) {
      const message = caught instanceof Error && caught.name === "NotAllowedError" ? "No se concedió permiso para usar NFC." : caught instanceof Error ? caught.message : "No se pudo grabar la pegatina NFC.";
      setError(message);
    } finally { setWriting(false); }
  }
  async function copyUrl() {
    setError(""); setSuccess("");
    try { await navigator.clipboard.writeText(url); setCopied(true); }
    catch { setError("No se pudo copiar automáticamente. Mantén pulsado el enlace y cópialo manualmente."); }
  }
  async function saveManualStatus(completed: boolean) {
    setSavingStatus(true); setError(""); setSuccess("");
    try { await onStatus(completed); setSuccess(completed ? "Pegatina marcada como grabada." : "Pegatina marcada como pendiente de grabar."); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "No se pudo guardar el estado de la pegatina."); }
    finally { setSavingStatus(false); }
  }
  return <Modal title="Grabar pegatina NFC" subtitle={`${tool.codigo} · ${tool.nombre}`} onClose={onClose}><div className="space-y-4">
    <div className="flex items-center gap-4 rounded-2xl border border-fuchsia-500/25 bg-fuchsia-500/10 p-4">{tool.foto_url ? <img src={tool.foto_url} alt={`Foto de ${tool.nombre}`} className="h-20 w-20 shrink-0 rounded-xl object-cover" /> : <span className="flex h-20 w-20 shrink-0 items-center justify-center rounded-xl bg-zinc-950/60 text-fuchsia-300"><Nfc size={34} /></span>}<div className="min-w-0"><p className="font-mono text-xs font-black text-cyan-300">{tool.codigo}</p><h3 className="mt-1 font-black text-white">{tool.nombre}</h3><p className="mt-1 text-xs leading-5 text-fuchsia-100/70">Al acercar el móvil se abrirá directamente la ficha de esta herramienta.</p></div></div>
    {!tool.qr_token && <Notice tone="red">Esta herramienta todavía no tiene identificador permanente. Aplica primero la actualización de QR.</Notice>}
    {tool.nfc_grabada_at && <Notice tone="green">NFC grabada el {formatDate(tool.nfc_grabada_at)}{tool.nfc_grabada_por ? ` por ${tool.nfc_grabada_por}` : ""}.</Notice>}
    {localOnly && <Notice tone="red">Este enlace usa localhost y solo funcionaría en este ordenador. Abre la web mediante su dirección de red o dominio antes de grabar la pegatina.</Notice>}
    {error && <div role="alert"><Notice tone="red">{error}</Notice></div>}
    {success && <div role="status"><Notice tone="green">{success}</Notice></div>}
    <div className="rounded-xl border border-zinc-700 bg-zinc-950/55 p-3"><p className="mb-2 text-[10px] font-black uppercase tracking-wide text-zinc-500">Enlace que se grabará</p><input readOnly value={url} onFocus={(event) => event.currentTarget.select()} className="input font-mono text-xs" aria-label="Enlace NFC de la herramienta" /></div>
    {directSupported ? <button disabled={writing || !url || localOnly} onClick={() => void writeTag()} className="flex min-h-16 w-full items-center justify-center gap-3 rounded-2xl bg-fuchsia-400 px-4 text-lg font-black text-zinc-950 disabled:opacity-40">{writing ? <><Loader2 className="animate-spin" /> Acerca ahora la pegatina…</> : <><Nfc /> Grabar directamente</>}</button> : <div className="rounded-xl border border-amber-500/25 bg-amber-500/10 p-4 text-sm leading-6 text-amber-100"><strong className="block">Grabación directa no disponible</strong>Copia el enlace y usa la opción Escribir → URL/URI de NFC Tools.</div>}
    <button disabled={!url} onClick={() => void copyUrl()} className="flex min-h-14 w-full items-center justify-center gap-2 rounded-xl border border-zinc-700 bg-zinc-950/40 font-black text-zinc-200 disabled:opacity-40">{copied ? <CheckCircle2 className="text-emerald-300" size={20} /> : <Copy size={20} />}{copied ? "Enlace copiado" : "Copiar enlace para NFC Tools"}</button>
    {!directSupported && !tool.nfc_grabada_at && <button disabled={savingStatus} onClick={() => void saveManualStatus(true)} className="flex min-h-14 w-full items-center justify-center gap-2 rounded-xl bg-emerald-400 px-4 font-black text-zinc-950 disabled:opacity-50">{savingStatus ? <Loader2 className="animate-spin" size={19} /> : <CheckCircle2 size={19} />} Ya la he grabado</button>}
    {tool.nfc_grabada_at && <button disabled={savingStatus} onClick={() => void saveManualStatus(false)} className="min-h-12 w-full rounded-xl border border-zinc-700 px-3 text-sm font-bold text-zinc-400 disabled:opacity-50">Marcar NFC como pendiente</button>}
    <p className="px-2 text-center text-xs leading-5 text-zinc-500">No bloquees la pegatina como solo lectura hasta haber comprobado que abre la herramienta correcta.</p>
  </div></Modal>;
}

type PlanSelection = { shelfId: number; level: number; position: string };

function UnlocatedToolsModal({ tools, onClose, onScan, onPlan }: { tools: HerramientaComun[]; onClose: () => void; onScan: (tool: HerramientaComun) => void; onPlan: (tool: HerramientaComun) => void }) {
  return <Modal title="Herramientas sin ubicación" subtitle={`${tools.length} pendiente${tools.length === 1 ? "" : "s"} de colocar`} onClose={onClose}><div className="space-y-3">{tools.length ? tools.map((tool) => <article key={tool.id} className="rounded-2xl border border-zinc-700 bg-zinc-950/55 p-3"><div className="flex items-center gap-3">{tool.foto_url ? <img src={tool.foto_url} alt="" className="h-14 w-14 shrink-0 rounded-xl object-cover" /> : <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-zinc-900 text-zinc-600"><Wrench size={24} /></span>}<div className="min-w-0"><p className="font-mono text-[10px] font-black text-cyan-300">{tool.codigo}</p><h3 className="truncate font-black text-white">{tool.nombre}</h3>{tool.espacio_ocupado && <p className="truncate text-xs font-bold text-violet-200">Ocupa: {tool.espacio_ocupado}</p>}</div></div><div className="mt-3 grid grid-cols-2 gap-2"><button onClick={() => onScan(tool)} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-emerald-400 px-2 text-sm font-black text-zinc-950"><ScanLine size={18} /> Escanear hueco</button><button onClick={() => onPlan(tool)} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-cyan-500/35 bg-cyan-500/10 px-2 text-sm font-black text-cyan-100"><LayoutGrid size={18} /> Elegir plano</button></div></article>) : <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/10 px-5 py-12 text-center"><CheckCircle2 className="mx-auto text-emerald-300" size={42} /><p className="mt-3 font-black text-emerald-100">Todas tienen ubicación</p></div>}</div></Modal>;
}

function PlaceToolPlanModal({ tool, shelves, busy, onClose, onConfirm }: { tool: HerramientaComun; shelves: EstanteriaHerramientas[]; busy: boolean; onClose: () => void; onConfirm: (shelf: EstanteriaHerramientas, level: number, position: string) => void }) {
  const [selected, setSelected] = useState<PlanSelection | null>(null);
  const selectedShelf = selected ? shelves.find((shelf) => shelf.id === selected.shelfId) : undefined;
  const zones = Object.entries(Object.groupBy(shelves, (shelf) => shelf.zona));

  return <Modal wide title="Elegir ubicación en el plano" subtitle={`¿Dónde vas a guardar ${tool.nombre}?`} onClose={onClose}><div className="space-y-6">
    {!shelves.length && <Notice tone="red">No hay estanterías configuradas. Un administrador debe crear primero el plano.</Notice>}
    {zones.map(([zone, zoneShelves]) => <section key={zone} className="space-y-3"><header className="flex items-center gap-2"><MapPin className="text-cyan-300" size={20} /><h3 className="text-lg font-black uppercase tracking-wide text-white">{zone}</h3></header><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{zoneShelves?.map((shelf) => {
      const rows = shelf.configuracion?.filas?.length ? shelf.configuracion.filas : fallbackRows(shelf.niveles);
      return <article key={shelf.id} className="overflow-hidden rounded-2xl border border-zinc-700 bg-zinc-950/60"><header className="border-b border-zinc-800 bg-zinc-900 px-4 py-3"><p className="font-mono text-xs font-black text-cyan-300">{shelf.codigo}</p><p className="font-black text-white">{shelf.nombre}</p></header><div className="space-y-1.5 p-3">{rows.map((row) => <div key={row.nivel} className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${row.columnas}, minmax(0, 1fr))` }}>{Array.from({ length: row.columnas }, (_, index) => {
        const position = `C${index + 1}`;
        const active = selected?.shelfId === shelf.id && selected.level === row.nivel && selected.position === position;
        const label = row.columnas > 1 ? `${row.nombre} · ${index + 1}` : row.nombre;
        return <button key={position} type="button" aria-pressed={active} onClick={() => setSelected({ shelfId: shelf.id, level: row.nivel, position })} className={`flex min-h-14 items-center justify-center gap-1 rounded-lg border px-1.5 py-2 text-center text-xs font-black transition ${active ? "border-emerald-300 bg-emerald-400 text-zinc-950 ring-2 ring-emerald-300/40" : row.tipo === "colgador" ? "border-amber-500/35 bg-amber-500/10 text-amber-100" : "border-zinc-700 bg-zinc-900 text-zinc-200 hover:border-cyan-400"}`}>{row.tipo === "colgador" && <Grip size={14} className="shrink-0" />}<span>{label}</span></button>;
      })}</div>)}</div></article>;
    })}</div></section>)}
    <div className="sticky bottom-0 -mx-5 border-t border-zinc-700 bg-zinc-900/95 px-5 pb-1 pt-4 backdrop-blur"><div className="mb-3 rounded-xl border border-cyan-500/25 bg-cyan-500/10 p-3"><p className="text-[10px] font-black uppercase tracking-wide text-cyan-300">Ubicación elegida</p><p className="mt-1 font-black text-white">{selected && selectedShelf ? locationName(selectedShelf, selected.level, selected.position) : "Pulsa un hueco del plano"}</p></div><button disabled={busy || !selected || !selectedShelf} onClick={() => selected && selectedShelf && onConfirm(selectedShelf, selected.level, selected.position)} className="flex min-h-14 w-full items-center justify-center gap-2 rounded-xl bg-emerald-400 px-4 font-black text-zinc-950 disabled:cursor-not-allowed disabled:opacity-40">{busy ? <Loader2 className="animate-spin" /> : <CheckCircle2 />} Confirmar y colocar aquí</button></div>
  </div></Modal>;
}

function ScannedLocationModal({ value, tools, returningTool, onClose, onRetry }: { value: ScannedLocation; tools: HerramientaComun[]; returningTool: HerramientaComun | null; onClose: () => void; onRetry: () => void }) {
  const scannedName = locationName(value.shelf, value.level, value.position);
  if (returningTool) return <Modal title="Ese no es su hueco" subtitle={returningTool.nombre} onClose={onClose}><div className="space-y-4"><div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-5"><AlertTriangle className="mb-3 text-red-300" size={34} /><p className="font-black text-red-100">No se ha registrado la devolución</p><p className="mt-2 text-sm text-red-200/70">Has escaneado: <strong>{scannedName}</strong></p></div><div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4"><p className="text-xs font-bold uppercase text-emerald-300">Su ubicación correcta</p><p className="mt-1 font-black text-emerald-100">{location(returningTool)}</p></div><button onClick={onRetry} className="flex min-h-16 w-full items-center justify-center gap-3 rounded-2xl bg-cyan-400 text-lg font-black text-zinc-950"><ScanLine /> Escanear el hueco correcto</button></div></Modal>;
  return <Modal title="Ubicación escaneada" subtitle={scannedName} onClose={onClose}><div className="space-y-4"><div className="rounded-2xl border border-cyan-500/30 bg-cyan-500/10 p-4"><p className="text-xs font-bold uppercase text-cyan-300">Aquí deben guardarse</p><p className="mt-1 text-2xl font-black text-white">{tools.length} herramienta{tools.length === 1 ? "" : "s"}</p></div>{tools.length ? <div className="space-y-2">{tools.map((tool) => <div key={tool.id} className="flex items-center justify-between gap-3 rounded-xl border border-zinc-800 bg-zinc-950/50 p-3"><div><p className="font-mono text-[10px] font-black text-cyan-300">{tool.codigo}</p><p className="font-bold text-white">{tool.nombre}</p></div><StatusBadge status={tool.estado} /></div>)}</div> : <Empty text="Este hueco no tiene herramientas asignadas." />}</div></Modal>;
}

type IdentificationFilter = "" | "pending" | "qr_pending" | "qr_done" | "nfc_pending" | "nfc_done" | "complete";

function LabelsModal({ tools, shelves, onClose, onPrinted, onReset, onNfc }: { tools: HerramientaComun[]; shelves: EstanteriaHerramientas[]; onClose: () => void; onPrinted: (tool: HerramientaComun) => void | Promise<unknown>; onReset: (tool: HerramientaComun, kind: "qr" | "nfc") => Promise<unknown>; onNfc: (tool: HerramientaComun) => void }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [identification, setIdentification] = useState<IdentificationFilter>("");
  const [resetting, setResetting] = useState("");
  const [tab, setTab] = useState<"tools" | "locations">("tools");
  const term = normalize(query);
  const categories = categoryOptions(tools);
  const filteredTools = tools.filter((tool) => {
    if (category && !splitCategories(tool.categoria).some((value) => normalize(value) === normalize(category))) return false;
    if (term && !normalize([tool.codigo, tool.nombre, tool.marca, tool.categoria, tool.descripcion, tool.estanteria?.codigo, tool.estanteria?.nombre, tool.estanteria?.zona].filter(Boolean).join(" ")).includes(term)) return false;
    if (identification === "pending" && tool.qr_impresa_at && tool.nfc_grabada_at) return false;
    if (identification === "qr_pending" && tool.qr_impresa_at) return false;
    if (identification === "qr_done" && !tool.qr_impresa_at) return false;
    if (identification === "nfc_pending" && tool.nfc_grabada_at) return false;
    if (identification === "nfc_done" && !tool.nfc_grabada_at) return false;
    if (identification === "complete" && (!tool.qr_impresa_at || !tool.nfc_grabada_at)) return false;
    return true;
  });
  const qrDone = tools.filter((tool) => tool.qr_impresa_at).length;
  const nfcDone = tools.filter((tool) => tool.nfc_grabada_at).length;
  const locationCount = shelves.reduce((total, shelf) => total + shelf.configuracion.filas.reduce((sum, row) => sum + row.columnas, 0), 0);
  async function reset(tool: HerramientaComun, kind: "qr" | "nfc") {
    const key = `${tool.id}-${kind}`; setResetting(key);
    try { await onReset(tool, kind); }
    catch (caught) { window.alert(caught instanceof Error ? caught.message : "No se pudo cambiar el estado."); }
    finally { setResetting(""); }
  }
  return <Modal wide title="Control de etiquetas" subtitle="Todas las herramientas en un solo sitio" onClose={onClose}><div className="space-y-5">
    <div className="grid grid-cols-3 gap-2"><IdentificationCount label="Herramientas" value={tools.length} tone="zinc" /><IdentificationCount label="QR impresos" value={qrDone} tone={qrDone === tools.length ? "green" : "cyan"} /><IdentificationCount label="NFC grabados" value={nfcDone} tone={nfcDone === tools.length ? "green" : "fuchsia"} /></div>
    <div className="grid grid-cols-2 rounded-2xl border border-zinc-700 bg-zinc-950 p-1.5" role="tablist" aria-label="Tipo de etiquetas">
      <button type="button" role="tab" aria-selected={tab === "tools"} onClick={() => setTab("tools")} className={`flex min-h-14 items-center justify-center gap-2 rounded-xl px-2 text-sm font-black ${tab === "tools" ? "bg-cyan-400 text-zinc-950" : "text-zinc-400"}`}><Wrench size={18} /> Herramientas <span className={`rounded-full px-2 py-0.5 text-xs ${tab === "tools" ? "bg-zinc-950/15" : "bg-zinc-800"}`}>{tools.length}</span></button>
      <button type="button" role="tab" aria-selected={tab === "locations"} onClick={() => setTab("locations")} className={`flex min-h-14 items-center justify-center gap-2 rounded-xl px-2 text-sm font-black ${tab === "locations" ? "bg-cyan-400 text-zinc-950" : "text-zinc-400"}`}><LayoutGrid size={18} /> Ubicaciones <span className={`rounded-full px-2 py-0.5 text-xs ${tab === "locations" ? "bg-zinc-950/15" : "bg-zinc-800"}`}>{locationCount}</span></button>
    </div>
    {tab === "tools" ? <section role="tabpanel" className="space-y-3">
      <label className="relative block"><span className="sr-only">Buscar herramienta</span><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-cyan-400" size={19} /><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar nombre, código o marca" className="input !min-h-13 !py-3 !pl-10 !pr-10" />{query && <button type="button" onClick={() => setQuery("")} aria-label="Limpiar búsqueda" className="absolute right-1.5 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-lg text-zinc-400 active:bg-zinc-800"><X size={17} /></button>}</label>
      <div className="grid grid-cols-2 gap-2"><label><span className="sr-only">Filtrar por categoría</span><select value={category} onChange={(event) => setCategory(event.target.value)} className="input !min-h-13 !py-3"><option value="">Todas las categorías</option>{categories.map((item) => <option key={item} value={item}>{item}</option>)}</select></label><label><span className="sr-only">Filtrar por identificación</span><select value={identification} onChange={(event) => setIdentification(event.target.value as IdentificationFilter)} className="input !min-h-13 !py-3"><option value="">Todos</option><option value="pending">Con algo pendiente</option><option value="qr_pending">QR sin imprimir</option><option value="qr_done">QR impresos</option><option value="nfc_pending">NFC sin grabar</option><option value="nfc_done">NFC grabados</option><option value="complete">QR + NFC terminados</option></select></label></div>
      <div className="flex items-center justify-between gap-3 px-1"><p className="text-sm font-bold text-cyan-200">{filteredTools.length} de {tools.length} herramientas</p>{(query || category || identification) && <button type="button" onClick={() => { setQuery(""); setCategory(""); setIdentification(""); }} className="min-h-9 px-2 text-sm font-black text-cyan-300">Limpiar filtros</button>}</div>
      <div className="max-h-[54dvh] space-y-3 overflow-y-auto pr-1">{filteredTools.length ? filteredTools.map((tool) => <article key={tool.id} className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950/50"><header className="flex items-center gap-3 border-b border-zinc-800 p-3">{tool.foto_url ? <img src={tool.foto_url} alt={`Foto de ${tool.nombre}`} loading="lazy" width={112} height={112} className="h-16 w-16 shrink-0 rounded-xl border border-zinc-700 object-cover" /> : <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-zinc-900 text-zinc-600"><Wrench size={25} /></span>}<div className="min-w-0 flex-1"><p className="font-mono text-[11px] font-black text-cyan-300">{tool.codigo}</p><h3 className="font-black leading-tight text-white">{tool.nombre}</h3><p className="mt-1 text-xs text-zinc-500">{tool.categoria || "Sin categoría"}{tool.estanteria ? ` · ${tool.estanteria.codigo}` : ""}</p><div className="mt-2 flex flex-wrap gap-1.5"><IdentificationBadge done={Boolean(tool.qr_impresa_at)} label="QR" /><IdentificationBadge done={Boolean(tool.nfc_grabada_at)} label="NFC" /></div></div></header><div className="space-y-2.5 p-3"><ToolQrLabelButton tool={tool} onPrinted={onPrinted} /><button type="button" onClick={() => onNfc(tool)} className="flex min-h-13 w-full items-center justify-center gap-2 rounded-xl border border-fuchsia-500/35 bg-fuchsia-500/10 px-3 font-black text-fuchsia-100"><Nfc size={19} /> {tool.nfc_grabada_at ? "Volver a grabar NFC" : "Grabar NFC"}</button>{(tool.qr_impresa_at || tool.nfc_grabada_at) && <details><summary className="min-h-10 cursor-pointer list-none py-2 text-center text-xs font-bold text-zinc-500">Corregir estado</summary><div className="grid grid-cols-2 gap-2">{tool.qr_impresa_at && <button disabled={resetting === `${tool.id}-qr`} onClick={() => void reset(tool, "qr")} className="min-h-11 rounded-lg border border-zinc-700 px-2 text-xs font-bold text-zinc-400 disabled:opacity-50">QR pendiente</button>}{tool.nfc_grabada_at && <button disabled={resetting === `${tool.id}-nfc`} onClick={() => void reset(tool, "nfc")} className="min-h-11 rounded-lg border border-zinc-700 px-2 text-xs font-bold text-zinc-400 disabled:opacity-50">NFC pendiente</button>}</div></details>}</div></article>) : <div className="rounded-2xl border border-dashed border-zinc-700 px-4 py-12 text-center text-sm text-zinc-500">No hay herramientas que coincidan con los filtros.</div>}</div>
    </section> : <section role="tabpanel" className="space-y-3"><div className="px-1"><h3 className="font-black text-white">Ubicaciones por estantería</h3><p className="mt-1 text-sm text-zinc-500">Cada acción imprime todos los huecos de la estantería seleccionada.</p></div><div className="max-h-[58dvh] space-y-3 overflow-y-auto pr-1">{shelves.map((shelf) => { const count = shelf.configuracion.filas.reduce((sum, row) => sum + row.columnas, 0); return <article key={shelf.id} className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950/50"><header className="border-b border-zinc-800 p-4"><div className="flex items-start justify-between gap-3"><div><p className="font-mono text-xs font-black text-cyan-300">{shelf.codigo}</p><h3 className="font-black text-white">{shelf.nombre}</h3><p className="mt-1 text-sm text-zinc-500">{shelf.zona}</p></div><span className="rounded-full bg-zinc-800 px-3 py-1 text-xs font-black text-zinc-300">{count} etiqueta{count === 1 ? "" : "s"}</span></div></header><div className="p-3"><ShelfLocationLabelsButton shelf={shelf} /></div></article>; })}</div></section>}
  </div></Modal>;
}

function IdentificationCount({ label, value, tone }: { label: string; value: number; tone: "zinc" | "cyan" | "fuchsia" | "green" }) {
  const classes = { zinc: "border-zinc-700 bg-zinc-950 text-zinc-200", cyan: "border-cyan-500/30 bg-cyan-500/10 text-cyan-200", fuchsia: "border-fuchsia-500/30 bg-fuchsia-500/10 text-fuchsia-200", green: "border-emerald-500/30 bg-emerald-500/10 text-emerald-200" }[tone];
  return <div className={`rounded-xl border p-2.5 text-center ${classes}`}><p className="text-xl font-black">{value}</p><p className="mt-0.5 text-[10px] font-black uppercase leading-4 tracking-wide">{label}</p></div>;
}

function IdentificationBadge({ done, label }: { done: boolean; label: string }) {
  return <span className={`rounded-full border px-2 py-1 text-[10px] font-black ${done ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200" : "border-amber-500/30 bg-amber-500/10 text-amber-200"}`}>{done ? <CheckCircle2 className="mr-1 inline" size={12} /> : <Clock3 className="mr-1 inline" size={12} />}{label} {done ? "hecho" : "pendiente"}</span>;
}

function ToolLabelAfterSaveModal({ tool, onClose, onNfc, onPrinted }: { tool: HerramientaComun; onClose: () => void; onNfc: () => void; onPrinted: (tool: HerramientaComun) => void | Promise<unknown> }) {
  return <Modal title="Herramienta guardada" subtitle={`${tool.codigo} · ${tool.nombre}`} onClose={onClose}><div className="space-y-4"><div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/10 p-5"><CheckCircle2 className="mb-3 text-emerald-300" size={34} /><p className="font-black text-emerald-100">Los datos se han guardado correctamente</p><p className="mt-1 text-sm text-emerald-200/60">Puedes identificarla con una etiqueta QR o grabar una pegatina NFC.</p></div><ToolQrLabelButton tool={tool} onPrinted={onPrinted} />{tool.qr_token && <button onClick={onNfc} className="flex min-h-14 w-full items-center justify-center gap-2 rounded-xl border border-fuchsia-500/35 bg-fuchsia-500/10 font-black text-fuchsia-100"><Nfc size={20} /> Preparar pegatina NFC</button>}<button onClick={onClose} className="min-h-12 w-full rounded-xl border border-zinc-700 font-bold text-zinc-300">Terminar sin imprimir</button></div></Modal>;
}

type ShelfDraft = { id?: number; codigo: string; nombre: string; zona: string; configuracion: ConfiguracionEstanteriaHerramientas };

function ShelfManager({ shelves, onClose, onChanged }: { shelves: EstanteriaHerramientas[]; onClose: () => void; onChanged: () => void | Promise<void> }) {
  const [draft, setDraft] = useState<ShelfDraft>(() => shelfDraft(shelves[0]));
  const [saving, setSaving] = useState(false); const [error, setError] = useState(""); const [success, setSuccess] = useState("");
  const updateRow = (index: number, patch: Partial<FilaEstanteriaHerramientas>) => setDraft((current) => ({ ...current, configuracion: { filas: current.configuracion.filas.map((row, rowIndex) => rowIndex === index ? { ...row, ...patch } : row) } }));
  const moveRow = (index: number, direction: -1 | 1) => setDraft((current) => { const rows = [...current.configuracion.filas]; const target = index + direction; if (target < 0 || target >= rows.length) return current; [rows[index], rows[target]] = [rows[target], rows[index]]; return { ...current, configuracion: { filas: rows } }; });
  async function save() { setSaving(true); setError(""); setSuccess(""); try { const response = await fetch(draft.id ? `/api/herramientas-comunes/estanterias/${draft.id}` : "/api/herramientas-comunes/estanterias", { method: draft.id ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(draft) }); const payload = await response.json() as EstanteriaHerramientas & { error?: string }; if (!response.ok) throw new Error(payload.error || "No se pudo guardar la estantería."); await onChanged(); setDraft(shelfDraft(payload)); setSuccess("Estantería guardada."); } catch (caught) { setError(caught instanceof Error ? caught.message : "No se pudo guardar la estantería."); } finally { setSaving(false); } }
  async function remove() { if (!draft.id || !window.confirm("¿Retirar esta estantería del plano?")) return; setSaving(true); setError(""); try { const response = await fetch(`/api/herramientas-comunes/estanterias/${draft.id}`, { method: "DELETE" }); const payload = await response.json() as { error?: string }; if (!response.ok) throw new Error(payload.error || "No se pudo retirar."); await onChanged(); const remaining = shelves.filter((item) => item.id !== draft.id); setDraft(shelfDraft(remaining[0])); setSuccess("Estantería retirada del plano."); } catch (caught) { setError(caught instanceof Error ? caught.message : "No se pudo retirar."); } finally { setSaving(false); } }
  return <Modal wide title="Configurar estanterías" subtitle="Puedes cambiar el plano sin tocar la base de datos" onClose={onClose}><div className="grid gap-5 lg:grid-cols-[240px_1fr]"><aside className="space-y-2"><button onClick={() => { setDraft(shelfDraft()); setError(""); setSuccess(""); }} className="flex w-full items-center justify-center gap-2 rounded-xl border border-cyan-500/30 bg-cyan-500/10 p-3 font-bold text-cyan-300"><Plus size={17} /> Nueva estantería</button>{shelves.map((shelf) => <button key={shelf.id} onClick={() => { setDraft(shelfDraft(shelf)); setError(""); setSuccess(""); }} className={`w-full rounded-xl border p-3 text-left ${draft.id === shelf.id ? "border-cyan-400 bg-cyan-500/10" : "border-zinc-800 bg-zinc-950/50"}`}><span className="font-mono text-xs font-black text-cyan-300">{shelf.codigo}</span><span className="block font-bold">{shelf.nombre}</span><span className="text-xs text-zinc-500">{shelf.zona} · {shelf.configuracion?.filas?.length || shelf.niveles} filas</span></button>)}</aside><section className="space-y-4">{error && <Notice tone="red">{error}</Notice>}{success && <Notice tone="green">{success}</Notice>}<div className="grid gap-3 sm:grid-cols-3"><Field label="Código"><input value={draft.codigo} onChange={(event) => setDraft((current) => ({ ...current, codigo: event.target.value.toUpperCase() }))} className="input" placeholder="T01" /></Field><Field label="Nombre"><input value={draft.nombre} onChange={(event) => setDraft((current) => ({ ...current, nombre: event.target.value }))} className="input" /></Field><Field label="Zona"><input value={draft.zona} onChange={(event) => setDraft((current) => ({ ...current, zona: event.target.value }))} className="input" placeholder="Taller" /></Field></div><div><div className="mb-2 flex items-center justify-between"><div><h3 className="font-black">Filas, de arriba hacia abajo</h3><p className="text-xs text-zinc-500">Añade divisiones verticales cuando una fila tenga varios huecos.</p></div><button onClick={() => setDraft((current) => ({ ...current, configuracion: { filas: [...current.configuracion.filas, { nivel: 1, nombre: `Nivel ${current.configuracion.filas.length + 1}`, tipo: "balda", columnas: 1, altura: 1 }] } }))} className="action action-primary"><Plus size={15} /> Fila</button></div><div className="space-y-2">{draft.configuracion.filas.map((row, index) => <div key={index} className="grid gap-2 rounded-xl border border-zinc-800 bg-zinc-950/45 p-3 sm:grid-cols-[auto_1fr_130px_100px_90px_auto]"><div className="flex sm:flex-col"><button disabled={index === 0} onClick={() => moveRow(index, -1)} className="p-1 text-zinc-500 disabled:opacity-20"><ArrowUp size={16} /></button><button disabled={index === draft.configuracion.filas.length - 1} onClick={() => moveRow(index, 1)} className="p-1 text-zinc-500 disabled:opacity-20"><ArrowDown size={16} /></button></div><input value={row.nombre} onChange={(event) => updateRow(index, { nombre: event.target.value })} className="input !py-2" aria-label="Nombre de la fila" /><select value={row.tipo} onChange={(event) => updateRow(index, { tipo: event.target.value as FilaEstanteriaHerramientas["tipo"] })} className="input !py-2"><option value="balda">Balda</option><option value="colgador">Colgador</option></select><label className="text-[10px] font-bold uppercase text-zinc-500">Divisiones<input type="number" min="1" max="12" value={row.columnas} onChange={(event) => updateRow(index, { columnas: Number(event.target.value) })} className="input mt-1 !py-1.5" /></label><label className="text-[10px] font-bold uppercase text-zinc-500">Altura<input type="number" min="1" max="4" value={row.altura} onChange={(event) => updateRow(index, { altura: Number(event.target.value) })} className="input mt-1 !py-1.5" /></label><button disabled={draft.configuracion.filas.length === 1} onClick={() => setDraft((current) => ({ ...current, configuracion: { filas: current.configuracion.filas.filter((_, rowIndex) => rowIndex !== index) } }))} className="self-center justify-self-end rounded-lg p-2 text-red-300 hover:bg-red-500/10 disabled:opacity-20" title="Eliminar fila"><Trash2 size={17} /></button></div>)}</div></div><div className="flex flex-col-reverse gap-2 border-t border-zinc-800 pt-4 sm:flex-row sm:justify-between">{draft.id ? <button disabled={saving} onClick={() => void remove()} className="inline-flex items-center justify-center gap-2 rounded-xl border border-red-500/30 px-4 py-3 font-bold text-red-300"><Trash2 size={17} /> Retirar estantería</button> : <span />}<button disabled={saving || !draft.configuracion.filas.length} onClick={() => void save()} className="inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-400 px-5 py-3 font-black text-zinc-950 disabled:opacity-50">{saving ? <Loader2 className="animate-spin" size={18} /> : <Settings size={18} />} Guardar plano</button></div></section></div></Modal>;
}

function LoanModal({ tool, currentUser, actionUsers, actionUsersLoading, askVehicle, requireVehicle, busy, error, onClose, onConfirm }: { tool: HerramientaComun; currentUser: AppUser | null; actionUsers: AppUser[]; actionUsersLoading: boolean; askVehicle: boolean; requireVehicle: boolean; busy: boolean; error: string; onClose: () => void; onConfirm: (vehicle: string, actorUserId: string, actorName: string) => void }) {
  const [vehicle, setVehicle] = useState(""); const [actorUserId, setActorUserId] = useState("");
  const actorName = currentUser?.rol === "administrador" ? actionUsers.find((user) => user.id === actorUserId)?.nombre || "" : currentUser?.nombre || "";
  return <Modal title="Retirar herramienta" subtitle={tool.nombre} onClose={onClose}><div className="space-y-4">{error && <div role="alert" aria-live="assertive"><Notice tone="red">{error}</Notice></div>}<ActionActorSelect currentUser={currentUser} users={actionUsers} loading={actionUsersLoading} value={actorUserId} onChange={setActorUserId} label="Empleado que retira la herramienta" /><div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-4 text-sm text-amber-100"><p><strong>Lugar de devolución:</strong> {location(tool)}</p></div>{askVehicle && <Field label={requireVehicle ? "Vehículo *" : "Vehículo (opcional)"}><input value={vehicle} onChange={(event) => setVehicle(event.target.value)} className="input" placeholder="Matrícula, modelo u orden de trabajo" /></Field>}<button disabled={busy || actionUsersLoading || (currentUser?.rol === "administrador" && !actorUserId) || (requireVehicle && !vehicle.trim())} onClick={() => onConfirm(vehicle, actorUserId, actorName)} className="flex min-h-14 w-full items-center justify-center gap-2 rounded-xl bg-amber-400 py-3 font-black text-zinc-950 disabled:opacity-50">{busy ? <Loader2 className="animate-spin" /> : <Wrench />} Confirmar retirada</button></div></Modal>;
}

function ReturnToolModal({ tool, currentUser, actionUsers, actionUsersLoading, allowIncidents, requireIncidentComment, busy, onClose, onConfirm }: { tool: HerramientaComun; currentUser: AppUser | null; actionUsers: AppUser[]; actionUsersLoading: boolean; allowIncidents: boolean; requireIncidentComment: boolean; busy: boolean; onClose: () => void; onConfirm: (draft: ReturnDraft) => void }) {
  const [actorUserId, setActorUserId] = useState("");
  const [incidentType, setIncidentType] = useState<"ok" | TipoIncidenciaHerramienta>("ok");
  const [detail, setDetail] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [error, setError] = useState("");
  const actorName = currentUser?.rol === "administrador" ? actionUsers.find((user) => user.id === actorUserId)?.nombre || "" : currentUser?.nombre || "";
  function choosePhoto(file?: File) { if (!file) return; if (!file.type.startsWith("image/") || file.size > PHOTO_SOURCE_MAX_BYTES) { setError("Selecciona una imagen válida de hasta 20 MB."); return; } setPhoto(file); setError(""); }
  function confirm() {
    if (currentUser?.rol === "administrador" && !actorUserId) { setError("Selecciona quién devuelve la herramienta."); return; }
    if (allowIncidents && requireIncidentComment && incidentType !== "ok" && !detail.trim()) { setError("Describe brevemente la incidencia."); return; }
    onConfirm({ actorUserId, actorName, incidentType: allowIncidents && incidentType !== "ok" ? incidentType : null, detail: allowIncidents ? detail.trim() : "", photo: allowIncidents ? photo : null });
  }
  const options: Array<{ value: "ok" | TipoIncidenciaHerramienta; title: string; tone: string }> = [{ value: "ok", title: "Todo correcto", tone: "border-emerald-400 bg-emerald-400 text-zinc-950" }, { value: "falta_pieza", title: "Falta una pieza", tone: "border-amber-400 bg-amber-400 text-zinc-950" }, { value: "danada", title: "Está dañada", tone: "border-red-400 bg-red-400 text-zinc-950" }, { value: "revision", title: "Necesita revisión", tone: "border-violet-400 bg-violet-400 text-zinc-950" }];
  return <Modal title="Devolver herramienta" subtitle={tool.nombre} onClose={onClose}><div className="space-y-4">{error && <Notice tone="red">{error}</Notice>}<ActionActorSelect currentUser={currentUser} users={actionUsers} loading={actionUsersLoading} value={actorUserId} onChange={setActorUserId} label="Empleado que la devuelve" />{allowIncidents ? <><div><p className="mb-2 text-xs font-bold uppercase text-zinc-400">¿Cómo vuelve?</p><div className="grid grid-cols-2 gap-2">{options.map((option) => <button type="button" key={option.value} onClick={() => { setIncidentType(option.value); setError(""); }} className={`min-h-14 rounded-xl border px-2 text-sm font-black ${incidentType === option.value ? option.tone : "border-zinc-700 bg-zinc-950 text-zinc-300"}`}>{option.title}</button>)}</div></div>{incidentType !== "ok" && <><Field label={requireIncidentComment ? "Qué ocurre *" : "Qué ocurre (opcional)"}><textarea value={detail} onChange={(event) => setDetail(event.target.value)} rows={3} maxLength={500} className="input resize-none" placeholder="Ej. falta el vaso de 13 mm..." /></Field><label className="flex min-h-14 cursor-pointer items-center justify-center gap-2 rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-3 font-bold text-cyan-200"><input type="file" accept="image/*" capture="environment" className="hidden" onChange={(event) => choosePhoto(event.target.files?.[0])} /><Camera size={19} />{photo ? `Foto: ${photo.name}` : "Añadir foto (opcional)"}</label></>}</> : <Notice tone="green">La devolución se registrará directamente como correcta.</Notice>}<button disabled={busy || actionUsersLoading} onClick={confirm} className="flex min-h-16 w-full items-center justify-center gap-2 rounded-xl bg-emerald-400 text-lg font-black text-zinc-950 disabled:opacity-50">{busy ? <Loader2 className="animate-spin" /> : <RotateCcw />} Continuar devolución</button></div></Modal>;
}

function ArchiveToolModal({ tool, busy, onClose, onConfirm }: { tool: HerramientaComun; busy: boolean; onClose: () => void; onConfirm: (reason: string) => void }) {
  const [reason, setReason] = useState("");
  return <Modal title="Archivar herramienta" subtitle={`${tool.codigo} · ${tool.nombre}`} onClose={onClose}><div className="space-y-4"><Notice tone="red">Dejará de aparecer en búsquedas, préstamos y plano, pero conservará sus fotos e historial. Podrás restaurarla después.</Notice><Field label="Motivo (opcional)"><textarea value={reason} onChange={(event) => setReason(event.target.value)} maxLength={500} rows={3} className="input resize-none" placeholder="Rota, retirada, sustituida..." /></Field><button disabled={busy || tool.estado === "prestada"} onClick={() => onConfirm(reason.trim())} className="flex min-h-14 w-full items-center justify-center gap-2 rounded-xl bg-red-500 font-black text-white disabled:opacity-40"><Archive size={19} />{tool.estado === "prestada" ? "Devuélvela antes de archivar" : "Archivar conservando el historial"}</button></div></Modal>;
}

function ArchivedToolsModal({ activeTools, archivedTools, busyId, onClose, onArchive, onRestore, onHistory }: { activeTools: HerramientaComun[]; archivedTools: HerramientaComun[]; busyId: number | null; onClose: () => void; onArchive: (tool: HerramientaComun) => void; onRestore: (tool: HerramientaComun) => void; onHistory: (tool: HerramientaComun) => void }) {
  const [query, setQuery] = useState(""); const [tab, setTab] = useState<"active" | "archived">("archived"); const term = normalize(query); const source = tab === "active" ? activeTools : archivedTools; const visible = term ? source.filter((tool) => normalize(`${tool.codigo} ${tool.nombre} ${tool.motivo_archivo || ""}`).includes(term)) : source;
  return <Modal title="Archivo de herramientas" subtitle="Dar de baja sin perder fotos ni historial" onClose={onClose}><div className="space-y-3"><div className="grid grid-cols-2 rounded-xl border border-zinc-700 bg-zinc-950 p-1"><button onClick={() => setTab("active")} className={`min-h-11 rounded-lg font-bold ${tab === "active" ? "bg-cyan-400 text-zinc-950" : "text-zinc-400"}`}>Activas ({activeTools.length})</button><button onClick={() => setTab("archived")} className={`min-h-11 rounded-lg font-bold ${tab === "archived" ? "bg-zinc-700 text-white" : "text-zinc-400"}`}>Archivadas ({archivedTools.length})</button></div><label className="relative block"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={18} /><input value={query} onChange={(event) => setQuery(event.target.value)} className="input !pl-10" placeholder="Buscar por nombre o código..." /></label>{visible.length ? visible.map((tool) => <article key={tool.id} className="rounded-xl border border-zinc-700 bg-zinc-950/50 p-4"><p className="font-mono text-xs font-black text-cyan-300">{tool.codigo}</p><h3 className="font-black text-white">{tool.nombre}</h3>{tab === "archived" && <><p className="mt-1 text-xs text-zinc-500">Archivada {formatDate(tool.archivada_at)} por {tool.archivada_por || "Administrador"}</p>{tool.motivo_archivo && <p className="mt-2 text-sm text-zinc-300">{tool.motivo_archivo}</p>}</>}<div className="mt-3 grid grid-cols-2 gap-2"><button onClick={() => onHistory(tool)} className="action"><History size={16} /> Historial</button>{tab === "archived" ? <button disabled={busyId === tool.id} onClick={() => onRestore(tool)} className="action action-success"><RotateCcw size={16} /> Restaurar</button> : <button disabled={tool.estado === "prestada"} onClick={() => onArchive(tool)} className="action text-red-300"><Archive size={16} />{tool.estado === "prestada" ? "Está prestada" : "Archivar"}</button>}</div></article>) : <Empty text={tab === "archived" ? "No hay herramientas archivadas." : "No hay herramientas que coincidan."} />}</div></Modal>;
}

function IncidentToolsModal({ tools, admin, busyId, onClose, onResolve, onHistory }: { tools: HerramientaComun[]; admin: boolean; busyId: number | null; onClose: () => void; onResolve: (tool: HerramientaComun) => void; onHistory: (tool: HerramientaComun) => void }) {
  return <Modal title="Incidencias abiertas" subtitle={`${tools.length} herramienta${tools.length === 1 ? "" : "s"} pendiente${tools.length === 1 ? "" : "s"} de revisar`} onClose={onClose}><div className="space-y-3">{tools.map((tool) => <article key={tool.id} className="rounded-xl border border-orange-500/35 bg-orange-500/10 p-4"><p className="font-mono text-xs font-black text-cyan-300">{tool.codigo}</p><h3 className="font-black text-white">{tool.nombre}</h3><p className="mt-2 font-bold text-orange-200">{incidentLabel(tool.incidencia_abierta_tipo)}</p>{tool.incidencia_abierta_detalle && <p className="mt-1 text-sm text-orange-100/70">{tool.incidencia_abierta_detalle}</p>}<p className="mt-2 text-xs text-zinc-500">Registrada {formatDate(tool.incidencia_abierta_at)}</p><div className="mt-3 grid grid-cols-2 gap-2"><button onClick={() => onHistory(tool)} className="action"><History size={16} /> Historial</button>{admin ? <button disabled={busyId === tool.id} onClick={() => onResolve(tool)} className="action action-success"><CheckCircle2 size={16} /> Resuelta</button> : <span className="flex items-center justify-center text-xs font-bold text-zinc-500">Avísale al administrador</span>}</div></article>)}</div></Modal>;
}

function LocationModal({ tool, shelves, busy, onClose, onConfirm }: { tool: HerramientaComun; shelves: EstanteriaHerramientas[]; busy: boolean; onClose: () => void; onConfirm: (shelfId: number, level: number, position: string) => void }) {
  const [shelfId, setShelfId] = useState(tool.estanteria_id || shelves[0]?.id || 0); const [level, setLevel] = useState(tool.nivel || shelves[0]?.configuracion?.filas?.[0]?.nivel || 1);
  const shelf = shelves.find((item) => item.id === shelfId) || shelves[0]; const rows = shelf?.configuracion?.filas || []; const selectedLevel = rows.some((row) => row.nivel === level) ? level : rows[0]?.nivel || 1; const row = rows.find((item) => item.nivel === selectedLevel); const [position, setPosition] = useState(normalizePosition(tool.posicion)); const selectedPosition = Number(position.slice(1)) <= (row?.columnas || 1) ? position : "C1";
  return <Modal title="Cambiar ubicación" subtitle={tool.nombre} onClose={onClose}><div className="space-y-4"><div className="rounded-xl border border-zinc-700 bg-zinc-950/50 p-3 text-sm text-zinc-400"><strong className="text-white">Ubicación actual:</strong> {location(tool)}</div><Field label="Estantería"><select value={shelf?.id || ""} onChange={(event) => { const next = Number(event.target.value); setShelfId(next); const nextShelf = shelves.find((item) => item.id === next); setLevel(nextShelf?.configuracion?.filas?.[0]?.nivel || 1); setPosition("C1"); }} className="input">{shelves.map((item) => <option key={item.id} value={item.id}>{item.zona} · {item.codigo} · {item.nombre}</option>)}</select></Field><div className="grid gap-4 sm:grid-cols-2"><Field label="Nivel o zona"><select value={selectedLevel} onChange={(event) => { setLevel(Number(event.target.value)); setPosition("C1"); }} className="input">{rows.map((item) => <option key={item.nivel} value={item.nivel}>{item.nombre}{item.tipo === "colgador" ? " · colgador" : ""}</option>)}</select></Field><Field label="Compartimento"><select value={selectedPosition} onChange={(event) => setPosition(event.target.value)} className="input">{Array.from({ length: row?.columnas || 1 }, (_, index) => <option key={index} value={`C${index + 1}`}>{row && row.columnas > 1 ? `Compartimento ${index + 1}` : "Espacio completo"}</option>)}</select></Field></div><button disabled={busy || !shelf} onClick={() => shelf && onConfirm(shelf.id, selectedLevel, selectedPosition)} className="flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-400 py-3 font-black text-zinc-950 disabled:opacity-50">{busy ? <Loader2 className="animate-spin" /> : <MapPin />} Guardar nueva ubicación</button></div></Modal>;
}

function GlobalHistoryModal({ onClose }: { onClose: () => void }) {
  const [items, setItems] = useState<GlobalMovement[]>([]);
  const [nextBeforeId, setNextBeforeId] = useState<number | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historyError, setHistoryError] = useState("");
  const [query, setQuery] = useState("");
  const [type, setType] = useState<MovimientoHerramienta["tipo"] | "">("");
  const loadHistory = useCallback(async (beforeId?: number) => {
    setLoadingHistory(true); setHistoryError("");
    try {
      const response = await fetch(`/api/herramientas-comunes/historial${beforeId ? `?before_id=${beforeId}` : ""}`, { cache: "no-store" });
      const payload = await response.json() as { movements?: GlobalMovement[]; nextBeforeId?: number | null; error?: string };
      if (!response.ok) throw new Error(payload.error || "No se pudo cargar el historial general.");
      setItems((current) => beforeId ? [...current, ...(payload.movements || [])] : payload.movements || []);
      setNextBeforeId(payload.nextBeforeId || null);
    } catch (caught) { setHistoryError(caught instanceof Error ? caught.message : "No se pudo cargar el historial general."); }
    finally { setLoadingHistory(false); }
  }, []);
  useEffect(() => { void Promise.resolve().then(() => loadHistory()); }, [loadHistory]);
  const term = normalize(query);
  const visibleItems = items.filter((item) => {
    if (type && item.tipo !== type) return false;
    if (!term) return true;
    return normalize([item.herramienta?.codigo, item.herramienta?.nombre, item.empleado, item.vehiculo, item.detalle, movementLabel(item)].filter(Boolean).join(" ")).includes(term);
  });
  return <Modal wide title="Historial general" subtitle="Todos los movimientos de herramientas, del más reciente al más antiguo" onClose={onClose}><div className="space-y-4">
    <div className="sticky top-0 z-10 -mx-1 grid gap-2 bg-zinc-900/95 px-1 pb-3 backdrop-blur sm:grid-cols-[1fr_220px]">
      <label className="relative block"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={18} /><input value={query} onChange={(event) => setQuery(event.target.value)} className="input !pl-10" placeholder="Buscar herramienta, empleado o vehículo" /></label>
      <label><span className="sr-only">Filtrar movimiento</span><select value={type} onChange={(event) => setType(event.target.value as MovimientoHerramienta["tipo"] | "")} className="input"><option value="">Todos los movimientos</option><option value="retirada">Retiradas</option><option value="devolucion">Devoluciones</option><option value="cambio_ubicacion">Movidas</option><option value="cambio_estado">Cambios de estado</option><option value="incidencia">Incidencias</option><option value="incidencia_resuelta">Incidencias resueltas</option><option value="alta">Altas</option><option value="edicion">Ediciones</option><option value="foto">Fotografías</option><option value="archivo">Archivo</option><option value="restauracion">Restauraciones</option></select></label>
    </div>
    {historyError && <Notice tone="red">{historyError}</Notice>}
    {visibleItems.length ? <div className="space-y-3">{visibleItems.map((item) => <article key={item.id} className={`rounded-2xl border p-4 ${movementCardClasses(item.tipo)}`}>
      <div className="flex items-start gap-3">{item.herramienta?.foto_url ? <img src={item.herramienta.foto_url} alt="" className="h-14 w-14 shrink-0 rounded-xl border border-white/10 object-cover" /> : <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-zinc-950/70 text-zinc-600"><Wrench size={23} /></span>}<div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><MovementBadge type={item.tipo} /><span className="text-xs text-zinc-500">{formatDate(item.created_at)}</span></div><p className="mt-2 font-black text-white">{item.herramienta?.nombre || "Herramienta eliminada"}</p>{item.herramienta && <p className="font-mono text-[10px] font-black text-cyan-300">{item.herramienta.codigo}{item.herramienta.archivada ? " · ARCHIVADA" : ""}</p>}<p className="mt-2 text-sm font-bold text-zinc-200">{movementLabel(item)}</p>{item.empleado && !["retirada", "devolucion", "incidencia"].includes(item.tipo) && <p className="mt-1 text-xs text-zinc-400">Por {item.empleado}</p>}{item.vehiculo && <p className="mt-1 text-xs font-bold text-amber-200">Vehículo: {item.vehiculo}</p>}{item.detalle && <p className="mt-2 text-sm leading-5 text-zinc-400">{item.detalle}</p>}</div></div>
    </article>)}</div> : !loadingHistory && <Empty text={items.length ? "No hay movimientos que coincidan con los filtros." : "Todavía no hay movimientos de herramientas."} />}
    {loadingHistory && <div className="flex items-center justify-center gap-2 py-5 font-bold text-cyan-300"><Loader2 className="animate-spin" size={21} /> Cargando movimientos…</div>}
    {nextBeforeId && !loadingHistory && <button onClick={() => void loadHistory(nextBeforeId)} className="min-h-14 w-full rounded-xl border border-zinc-700 bg-zinc-950/40 font-black text-zinc-200">Cargar movimientos anteriores</button>}
    {!nextBeforeId && items.length > 0 && <p className="py-2 text-center text-xs font-bold text-zinc-600">Has llegado al principio del historial.</p>}
  </div></Modal>;
}

function HistoryModal({ tool, movements, onClose }: { tool: HerramientaComun; movements: MovimientoHerramienta[]; onClose: () => void }) {
  const photos = tool.fotos || [];
  const initialPhoto = photos.find((photo) => photo.tipo === "inicial");
  const currentPhoto = photos.at(-1);
  const [items, setItems] = useState(movements);
  const [nextBeforeId, setNextBeforeId] = useState<number | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historyError, setHistoryError] = useState("");
  const loadHistory = useCallback(async (beforeId?: number) => {
    setLoadingHistory(true); setHistoryError("");
    try {
      const response = await fetch(`/api/herramientas-comunes/${tool.id}/historial${beforeId ? `?before_id=${beforeId}` : ""}`, { cache: "no-store" });
      const payload = await response.json() as { movements?: MovimientoHerramienta[]; nextBeforeId?: number | null; error?: string };
      if (!response.ok) throw new Error(payload.error || "No se pudo cargar el historial.");
      setItems((current) => beforeId ? [...current, ...(payload.movements || [])] : payload.movements || []);
      setNextBeforeId(payload.nextBeforeId || null);
    } catch (caught) { setHistoryError(caught instanceof Error ? caught.message : "No se pudo cargar el historial."); }
    finally { setLoadingHistory(false); }
  }, [tool.id]);
  useEffect(() => { void Promise.resolve().then(() => loadHistory()); }, [loadHistory]);
  return <Modal title="Historial completo" subtitle={`${tool.codigo} · ${tool.nombre}`} onClose={onClose}><div className="space-y-5">{initialPhoto && <section><h3 className="mb-2 text-sm font-black text-white">Estado fotográfico</h3><div className="grid grid-cols-2 gap-3"><PhotoSnapshot title="Foto inicial" url={initialPhoto.url} date={initialPhoto.created_at} />{currentPhoto && currentPhoto.id !== initialPhoto.id && <PhotoSnapshot title="Foto más reciente" url={currentPhoto.url} date={currentPhoto.created_at} />}</div>{photos.length > 2 && <p className="mt-2 text-xs text-zinc-500">Se conservan {photos.length} fotografías en total.</p>}</section>}{historyError && <Notice tone="red">{historyError}</Notice>}{items.length ? <div className="space-y-3">{items.map((item) => <div key={item.id} className={`rounded-xl border p-4 ${item.tipo === "incidencia" ? "border-red-500/35 bg-red-500/10" : item.tipo === "retirada" ? "border-amber-500/25 bg-amber-500/5" : item.tipo === "devolucion" || item.tipo === "incidencia_resuelta" ? "border-emerald-500/25 bg-emerald-500/5" : "border-zinc-800 bg-zinc-950/50"}`}><div className="flex items-start justify-between gap-3"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><MovementBadge type={item.tipo} /><p className="font-bold text-white">{movementLabel(item)}</p></div>{item.vehiculo && <p className="mt-2 text-sm text-zinc-400">Vehículo: {item.vehiculo}</p>}{item.detalle && <p className="mt-1 text-sm text-zinc-300">{item.detalle}</p>}{item.foto_url && <img src={item.foto_url} alt="Foto de la incidencia" className="mt-3 max-h-56 w-full rounded-xl object-contain" />}</div><span className="whitespace-nowrap text-xs text-zinc-600">{formatDate(item.created_at)}</span></div></div>)}</div> : !loadingHistory && <Empty text="Todavía no hay movimientos." />}{loadingHistory && <div className="flex justify-center py-4"><Loader2 className="animate-spin text-cyan-300" /></div>}{nextBeforeId && !loadingHistory && <button onClick={() => void loadHistory(nextBeforeId)} className="min-h-12 w-full rounded-xl border border-zinc-700 font-bold text-zinc-300">Cargar movimientos anteriores</button>}</div></Modal>;
}

function PhotoSnapshot({ title, url, date }: { title: string; url: string; date: string }) {
  return <figure className="overflow-hidden rounded-xl border border-zinc-700 bg-zinc-950"><img src={url} alt={title} className="aspect-square w-full object-cover" /><figcaption className="p-2"><p className="text-xs font-black text-white">{title}</p><p className="text-[10px] text-zinc-500">{formatDate(date)}</p></figcaption></figure>;
}

function PhotoPreview({ url, alt, onClose }: { url: string; alt: string; onClose: () => void }) {
  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [onClose]);
  return <div onClick={(event) => event.stopPropagation()} className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-8"><button type="button" aria-label="Cerrar fotografía" onClick={onClose} className="absolute inset-0 bg-black/95" /><div className="relative z-10 flex max-h-full max-w-full items-center justify-center"><img src={url} alt={alt} className="max-h-[92dvh] max-w-[94vw] rounded-2xl object-contain shadow-2xl" /><button type="button" onClick={onClose} className="absolute right-2 top-2 rounded-full border border-white/20 bg-black/75 p-3 text-white shadow-xl" aria-label="Cerrar"><X size={24} /></button></div></div>;
}

function Modal({ title, subtitle, onClose, children, wide = false }: { title: string; subtitle?: string; onClose: () => void; children: ReactNode; wide?: boolean }) { return <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/85 backdrop-blur-sm sm:items-center sm:p-4"><div className={`flex max-h-[96dvh] w-full flex-col overflow-hidden rounded-t-3xl border border-zinc-700 bg-zinc-900 shadow-2xl sm:rounded-3xl ${wide ? "max-w-6xl" : "max-w-2xl"}`}><header className="flex items-start justify-between border-b border-zinc-800 p-5"><div><h2 className="text-xl font-black">{title}</h2>{subtitle && <p className="mt-1 text-sm text-zinc-500">{subtitle}</p>}</div><button onClick={onClose} className="rounded-xl p-2 text-zinc-400 hover:bg-zinc-800"><X /></button></header><div className="overflow-y-auto p-5">{children}</div></div></div>; }
function Field({ label, children }: { label: string; children: ReactNode }) { return <label className="block"><span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-zinc-400">{label}</span>{children}</label>; }
function StatusBadge({ status }: { status: EstadoHerramienta }) { const item = STATUS[status]; return <span className={`rounded-full border px-2.5 py-1 text-xs font-black ${item.classes}`}>{item.label}</span>; }
function ToolStatusBadge({ tool }: { tool: HerramientaComun }) { if (tool.incidencia_abierta_tipo) return <span className="rounded-full border border-orange-500/40 bg-orange-500/10 px-2.5 py-1 text-xs font-black text-orange-200">Reportada</span>; return <StatusBadge status={tool.estado} />; }
function ToolModeBadge({ tool }: { tool: HerramientaComun }) { return <>{tool.solo_localizacion && <span className="rounded-full border border-violet-500/30 bg-violet-500/10 px-2.5 py-1 text-xs font-black text-violet-200">Solo localizar</span>}{tool.incidencia_abierta_tipo && <span className="rounded-full border border-orange-500/40 bg-orange-500/10 px-2.5 py-1 text-xs font-black text-orange-200">{incidentLabel(tool.incidencia_abierta_tipo)}</span>}</>; }
function Summary({ label, value, tone }: { label: string; value: number; tone: "cyan" | "emerald" | "amber" | "red" }) { const colors = { cyan: "border-cyan-500/20 text-cyan-300", emerald: "border-emerald-500/20 text-emerald-300", amber: "border-amber-500/20 text-amber-300", red: "border-red-500/30 text-red-300" }; return <div className={`rounded-xl border bg-zinc-900/80 p-3 text-center sm:rounded-2xl sm:p-4 ${colors[tone]}`}><p className="text-[10px] font-bold uppercase sm:text-xs">{label}</p><p className="mt-1 text-2xl font-black text-white">{value}</p></div>; }
function Notice({ tone, children }: { tone: "red" | "green"; children: ReactNode }) { return <div className={`rounded-xl border p-4 text-sm ${tone === "red" ? "border-red-500/30 bg-red-500/10 text-red-200" : "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"}`}>{children}</div>; }
function ViewButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) { return <button onClick={onClick} className={`flex items-center justify-center gap-1 rounded-lg px-3 py-2 text-sm font-bold ${active ? "bg-zinc-700 text-white" : "text-zinc-500"}`}>{children}</button>; }
function Empty({ text = "No hay herramientas que coincidan con la búsqueda." }: { text?: string }) { return <div className="rounded-2xl border border-dashed border-zinc-700 py-16 text-center text-zinc-500"><Wrench className="mx-auto mb-3 text-zinc-700" size={42} /><p>{text}</p></div>; }
function splitCategories(value?: string | null) { return (value || "").split(",").map((category) => category.trim()).filter(Boolean); }
function categoryOptions(tools: HerramientaComun[]) { const unique = new Map<string, string>(); tools.flatMap((tool) => splitCategories(tool.categoria)).forEach((category) => { const key = normalize(category); if (!unique.has(key)) unique.set(key, category); }); return Array.from(unique.values()).sort((left, right) => left.localeCompare(right, "es", { sensitivity: "base" })); }
function normalize(value: string) { return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es").trim(); }
function location(tool: HerramientaComun) { if (!tool.estanteria_id || !tool.nivel || !tool.posicion || !tool.estanteria) return "Sin ubicación asignada"; const row = tool.estanteria.configuracion?.filas?.find((item) => item.nivel === tool.nivel); const position = normalizePosition(tool.posicion); return `${tool.estanteria.zona} · ${tool.estanteria.codigo} · ${row?.nombre || `nivel ${tool.nivel}`}${row && row.columnas > 1 ? ` · compartimento ${position.slice(1)}` : ""}`; }
function locationName(shelf: EstanteriaHerramientas, level: number, position: string) { const row = shelf.configuracion.filas.find((item) => item.nivel === level); return `${shelf.zona} · ${shelf.codigo} · ${row?.nombre || `nivel ${level}`}${row && row.columnas > 1 ? ` · compartimento ${normalizePosition(position).slice(1)}` : ""}`; }
function formatDate(value: string | null) { return value ? new Date(value).toLocaleString("es-ES", { dateStyle: "short", timeStyle: "short" }) : ""; }
function movementCardClasses(type: MovimientoHerramienta["tipo"]) { if (type === "retirada") return "border-amber-500/25 bg-amber-500/5"; if (type === "devolucion" || type === "incidencia_resuelta" || type === "restauracion") return "border-emerald-500/25 bg-emerald-500/5"; if (type === "incidencia" || type === "cambio_estado") return "border-red-500/30 bg-red-500/5"; if (type === "cambio_ubicacion") return "border-violet-500/25 bg-violet-500/5"; return "border-zinc-800 bg-zinc-950/50"; }
function MovementBadge({ type }: { type: MovimientoHerramienta["tipo"] }) { const badges: Record<MovimientoHerramienta["tipo"], { label: string; classes: string }> = { alta: { label: "ALTA", classes: "bg-cyan-400" }, retirada: { label: "RETIRÓ", classes: "bg-amber-400" }, devolucion: { label: "COLOCÓ", classes: "bg-emerald-400" }, cambio_estado: { label: "ESTADO", classes: "bg-red-400" }, cambio_ubicacion: { label: "MOVIDA", classes: "bg-violet-400" }, edicion: { label: "EDITADA", classes: "bg-sky-400" }, foto: { label: "FOTO", classes: "bg-fuchsia-400" }, incidencia: { label: "INCIDENCIA", classes: "bg-red-400" }, incidencia_resuelta: { label: "RESUELTA", classes: "bg-emerald-400" }, archivo: { label: "ARCHIVO", classes: "bg-zinc-400" }, restauracion: { label: "RESTAURADA", classes: "bg-emerald-400" } }; const badge = badges[type]; return <span className={`rounded-full px-2.5 py-1 text-[10px] font-black text-zinc-950 ${badge.classes}`}>{badge.label}</span>; }
function movementLabel(item: MovimientoHerramienta) { if (item.tipo === "retirada") return `${item.empleado || "Empleado sin indicar"} retiró la herramienta`; if (item.tipo === "devolucion") return `${item.empleado || "Empleado sin indicar"} colocó la herramienta en su sitio`; if (item.tipo === "incidencia") return `${item.empleado || "Empleado sin indicar"} indicó: ${incidentLabel(item.incidencia_tipo)}`; return ({ alta: "Herramienta registrada", cambio_estado: item.estado_nuevo === "perdida" ? "Reportada como no encontrada" : "Marcada como encontrada y disponible", cambio_ubicacion: "Herramienta movida a otra ubicación", edicion: "Datos generales actualizados", foto: "Fotografía actualizada", incidencia_resuelta: "Incidencia marcada como resuelta", archivo: "Herramienta archivada", restauracion: "Herramienta restaurada" })[item.tipo]; }
function incidentLabel(type: TipoIncidenciaHerramienta | null | undefined) { return type === "falta_pieza" ? "Falta una pieza" : type === "danada" ? "Está dañada" : type === "revision" ? "Necesita revisión" : "Incidencia"; }
function isLoanOverdue(tool: HerramientaComun, hours: number) { return tool.estado === "prestada" && Boolean(tool.retirada_at) && Date.now() - new Date(tool.retirada_at!).getTime() >= hours * 60 * 60 * 1000; }
function elapsedLoan(value: string | null) { if (!value) return ""; const hours = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 3_600_000)); if (hours < 24) return `${hours} h`; const days = Math.floor(hours / 24); return `${days} día${days === 1 ? "" : "s"}`; }
function fallbackRows(levels: number): FilaEstanteriaHerramientas[] { return Array.from({ length: levels }, (_, index) => ({ nivel: levels - index, nombre: `Nivel ${levels - index}`, tipo: "balda", columnas: 1, altura: 1 })); }
function normalizePosition(value: string | null | undefined) { const match = /^C(\d+)$/i.exec(value || ""); return match ? `C${Number(match[1])}` : "C1"; }
function shelfDraft(shelf?: EstanteriaHerramientas): ShelfDraft { return shelf ? { id: shelf.id, codigo: shelf.codigo, nombre: shelf.nombre, zona: shelf.zona, configuracion: { filas: (shelf.configuracion?.filas?.length ? shelf.configuracion.filas : fallbackRows(shelf.niveles)).map((row) => ({ ...row })) } } : { codigo: "", nombre: "Nueva estantería", zona: "Taller", configuracion: { filas: [{ nivel: 1, nombre: "Nivel 1", tipo: "balda", columnas: 1, altura: 1 }] } }; }
