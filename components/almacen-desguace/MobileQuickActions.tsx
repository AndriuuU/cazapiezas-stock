"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { createPortal } from "react-dom";
import { Archive, CheckCircle2, ChevronLeft, Images, Loader2, MapPin, PackagePlus, Plus, ScanBarcode, ShoppingBag, Warehouse, X } from "lucide-react";
import BarcodeScanner from "@/components/almacen-desguace/BarcodeScanner";
import SaleModal from "@/components/almacen-desguace/SaleModal";
import { ActionActorSelect, useActionActors } from "@/components/auth/ActionActorSelect";
import { useCurrentUser } from "@/components/auth/useCurrentUser";
import type { AppUser } from "@/lib/app-users";
import type { CajonDesguace, PiezaDesguace, SugerenciaUbicacion } from "@/types/almacen-desguace";

type QuickAction = "locate" | "sell" | "photos" | "series";
type FreeLocation = { ubicacion: string; zona: string; estanteria_codigo: string; estanteria_nombre: string; nivel: number; hueco: number };
type LastDestination = { kind: "shelf"; location: string } | { kind: "drawer"; drawerId: number; label: string };
type ListResponse = { items?: PiezaDesguace[]; error?: string };

const LAST_DESTINATION_KEY = "cazapiezas:last-mobile-destination";

function normalize(value: string | null | undefined) {
  return (value || "").trim().toLocaleLowerCase("es").replace(/[^a-z0-9]/g, "");
}

function locationParts(location: string) {
  const match = location.match(/^DESGUACE-(E\d{2})-N(\d{2})-C(\d{2})$/);
  return match ? { shelf: match[1], level: Number(match[2]), slot: Number(match[3]) } : null;
}

function rememberDestination(destination: LastDestination) {
  try { window.localStorage.setItem(LAST_DESTINATION_KEY, JSON.stringify(destination)); } catch { /* El navegador puede bloquear el almacenamiento privado. */ }
}

function readDestination(): LastDestination | null {
  try {
    const value = JSON.parse(window.localStorage.getItem(LAST_DESTINATION_KEY) || "null") as LastDestination | null;
    if (value?.kind === "shelf" && locationParts(value.location)) return value;
    if (value?.kind === "drawer" && Number.isInteger(value.drawerId)) return value;
  } catch { /* Valor antiguo o no válido. */ }
  return null;
}

function notifyWarehouseChanged() {
  window.dispatchEvent(new Event("warehouse-data-changed"));
}

export default function MobileQuickActions({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const currentUser = useCurrentUser();
  const actionActors = useActionActors(currentUser);
  const [actorUserId, setActorUserId] = useState("");
  const [action, setAction] = useState<QuickAction | null>(null);
  const [scanning, setScanning] = useState(false);
  const [searching, setSearching] = useState(false);
  const [piece, setPiece] = useState<PiezaDesguace | null>(null);
  const [matches, setMatches] = useState<PiezaDesguace[]>([]);
  const [freeLocations, setFreeLocations] = useState<FreeLocation[]>([]);
  const [drawers, setDrawers] = useState<CajonDesguace[]>([]);
  const [selectedLocation, setSelectedLocation] = useState("");
  const [selectedDrawer, setSelectedDrawer] = useState("");
  const [destinationsLoading, setDestinationsLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [lastDestination, setLastDestination] = useState<LastDestination | null>(() => typeof window === "undefined" ? null : readDestination());

  const chooseRepeatShelfLocation = useCallback((locations: FreeLocation[], destination: LastDestination | null) => {
    if (destination?.kind !== "shelf") return "";
    const previous = locationParts(destination.location);
    if (!previous) return "";
    const sameLevel = locations
      .filter((item) => item.estanteria_codigo === previous.shelf && item.nivel === previous.level)
      .sort((left, right) => left.hueco - right.hueco);
    return sameLevel.find((item) => item.hueco > previous.slot)?.ubicacion || sameLevel[0]?.ubicacion || "";
  }, []);

  const loadDestinations = useCallback(async (target: PiezaDesguace, currentAction: QuickAction) => {
    setDestinationsLoading(true); setError("");
    try {
      const [locationsResponse, drawersResponse, suggestionResponse] = await Promise.all([
        fetch("/api/almacen-desguace/ubicaciones/disponibles", { cache: "no-store" }),
        fetch("/api/almacen-desguace/cajones", { cache: "no-store" }),
        fetch(`/api/almacen-desguace/${target.id}/ubicar`, { cache: "no-store" }),
      ]);
      const locations = await locationsResponse.json() as FreeLocation[] & { error?: string };
      const drawerRows = await drawersResponse.json() as CajonDesguace[] & { error?: string };
      const suggestion = await suggestionResponse.json() as { suggestion?: SugerenciaUbicacion | null; error?: string };
      if (!locationsResponse.ok) throw new Error(locations.error || "No se pudieron cargar los huecos libres.");
      if (!drawersResponse.ok) throw new Error(drawerRows.error || "No se pudieron cargar los cajones.");
      setFreeLocations(locations);
      const availableDrawers = drawerRows.filter((drawer) => drawer.activo && !drawer.lleno && drawer.disponibles > 0);
      setDrawers(availableDrawers);

      const remembered = readDestination();
      setLastDestination(remembered);
      if (currentAction === "series" && remembered?.kind === "drawer" && availableDrawers.some((drawer) => drawer.id === remembered.drawerId)) {
        setSelectedDrawer(String(remembered.drawerId)); setSelectedLocation("");
      } else {
        const repeated = currentAction === "series" ? chooseRepeatShelfLocation(locations, remembered) : "";
        setSelectedLocation(repeated || suggestion.suggestion?.ubicacion || "");
        setSelectedDrawer("");
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudieron cargar los destinos.");
    } finally { setDestinationsLoading(false); }
  }, [chooseRepeatShelfLocation]);

  function selectAction(next: QuickAction) {
    setAction(next); setPiece(null); setMatches([]); setError(""); setSuccess(""); setScanning(true);
  }

  async function findPiece(value: string) {
    setScanning(false); setSearching(true); setError(""); setMatches([]);
    try {
      const query = new URLSearchParams({ q: value, page: "1", page_size: "10", vista: "almacen" });
      const response = await fetch(`/api/almacen-desguace?${query}`, { cache: "no-store" });
      const data = await response.json() as ListResponse;
      if (!response.ok) throw new Error(data.error || "No se pudo buscar la pieza.");
      const rows = data.items || [];
      const wanted = normalize(value);
      const exact = rows.filter((item) => [item.codigo_interno, item.referencia_principal, item.referencia_oem, item.codigo_recambio_facil].some((candidate) => normalize(candidate) === wanted));
      const candidates = exact.length ? exact : rows;
      if (!candidates.length) throw new Error(`No se encontró ninguna pieza almacenada con el código ${value}.`);
      if (candidates.length > 1) { setMatches(candidates); return; }
      await acceptPiece(candidates[0]);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo encontrar la pieza.");
    } finally { setSearching(false); }
  }

  async function acceptPiece(target: PiezaDesguace) {
    setMatches([]); setPiece(target); setError("");
    if (action === "photos") {
      onClose();
      router.push(`/almacen-desguace/${target.id}#fotografias`);
    } else if (action === "locate" || action === "series") {
      await loadDestinations(target, action);
    }
  }

  async function saveLocation() {
    if (!piece || (!selectedLocation && !selectedDrawer)) return;
    if (selectedLocation && currentUser?.rol === "administrador" && !actorUserId) {
      setError("Selecciona el empleado que coloca la pieza.");
      return;
    }
    setSaving(true); setError("");
    try {
      let message = "";
      let destination: LastDestination;
      if (selectedDrawer) {
        const drawer = drawers.find((item) => item.id === Number(selectedDrawer));
        if (!drawer) throw new Error("El cajón seleccionado ya no está disponible.");
        const response = await fetch(`/api/almacen-desguace/cajones/${drawer.id}/piezas`, {
          method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "add", pieza_id: piece.id }),
        });
        const data = await response.json() as { error?: string };
        if (!response.ok) throw new Error(data.error || "No se pudo guardar la pieza en el cajón.");
        destination = { kind: "drawer", drawerId: drawer.id, label: `${drawer.codigo} · ${drawer.nombre}` };
        message = `${piece.codigo_interno} guardada en ${drawer.codigo}.`;
      } else {
        const response = await fetch(`/api/almacen-desguace/${piece.id}/ubicar`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ resultado: "colocada_alternativa", ubicacion_final: selectedLocation, motivo: action === "series" ? "Ubicación rápida en serie" : "Ubicación rápida desde móvil", actor_user_id: actorUserId }),
        });
        const data = await response.json() as { error?: string };
        if (!response.ok) throw new Error(data.error || "No se pudo ubicar la pieza.");
        destination = { kind: "shelf", location: selectedLocation };
        message = `${piece.codigo_interno} guardada en ${selectedLocation}.`;
      }
      rememberDestination(destination);
      setLastDestination(destination);
      notifyWarehouseChanged();
      router.refresh();
      setSuccess(message);
      setPiece(null);
      setSelectedDrawer(""); setSelectedLocation("");
      if (navigator.vibrate) navigator.vibrate(70);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo guardar la ubicación.");
    } finally { setSaving(false); }
  }

  function scanAnother() {
    setSuccess(""); setError(""); setMatches([]); setPiece(null); setScanning(true);
  }

  if (scanning) return <BarcodeScanner onScan={(value) => void findPiece(value)} onClose={() => { setScanning(false); if (!piece) setAction(null); }} />;
  if (piece && action === "sell") return createPortal(
    <SaleModal piece={piece} onClose={() => { setPiece(null); setAction(null); }} onSold={(message) => { notifyWarehouseChanged(); router.refresh(); setPiece(null); setSuccess(message); }} />,
    document.body,
  );

  return <div className="fixed inset-0 flex flex-col items-center justify-end bg-black/85 backdrop-blur-md sm:px-6 sm:pb-2 sm:pt-6" style={{ zIndex: 200, isolation: "isolate" }} onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section role="dialog" aria-modal="true" aria-label="Acciones rápidas" className="flex max-h-full w-full flex-col overflow-hidden rounded-t-3xl border border-zinc-700 bg-zinc-950 shadow-2xl shadow-black sm:max-h-[calc(100dvh-3rem)] sm:max-w-2xl sm:rounded-3xl">
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-zinc-800 px-4 py-3">
        <div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500 text-zinc-950"><ScanBarcode size={22} /></span><div><h2 className="font-black text-white">Acciones rápidas</h2><p className="text-xs text-zinc-500">Escanea y trabaja sin salir del móvil</p></div></div>
        <button type="button" onClick={onClose} aria-label="Cerrar acciones rápidas" className="rounded-xl border border-zinc-700 p-2 text-zinc-400"><X size={20} /></button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {searching && <div className="flex min-h-52 items-center justify-center gap-2 text-zinc-400"><Loader2 className="animate-spin text-cyan-400" /> Buscando la pieza...</div>}
        {error && <div role="alert" className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm font-semibold text-red-200">{error}</div>}
        {success && <SuccessPanel message={success} series={action === "series"} onNext={scanAnother} onFinish={onClose} />}

        {!searching && !success && matches.length > 1 && <div className="space-y-3"><p className="font-black text-white">Elige la pieza correcta</p>{matches.map((item) => <button key={item.id} onClick={() => void acceptPiece(item)} className="w-full rounded-xl border border-zinc-700 bg-zinc-900 p-4 text-left"><span className="font-mono text-sm font-black text-amber-300">{item.codigo_interno}</span><span className="mt-1 block font-bold text-white">{item.nombre_pieza || "Pieza sin nombre"}</span><span className="mt-1 block text-xs text-zinc-500">{item.referencia_principal || item.referencia_oem || "Sin referencia"}</span></button>)}<button onClick={() => setScanning(true)} className="w-full rounded-xl border border-zinc-700 py-3 font-bold text-zinc-300">Escanear otra vez</button></div>}

        {!action && !searching && <ActionMenu onAction={selectAction} onClose={onClose} />}

        {action && !piece && !matches.length && !searching && !success && <div className="py-8 text-center"><ScanBarcode className="mx-auto text-zinc-700" size={46} /><p className="mt-3 font-bold text-zinc-300">No hay ninguna pieza seleccionada.</p><button onClick={() => setScanning(true)} className="mt-4 rounded-xl bg-cyan-500 px-5 py-3 font-black text-zinc-950">Escanear pieza</button></div>}

        {piece && (action === "locate" || action === "series") && <LocationPanel piece={piece} series={action === "series"} loading={destinationsLoading} saving={saving} locations={freeLocations} drawers={drawers} selectedLocation={selectedLocation} selectedDrawer={selectedDrawer} lastDestination={lastDestination} currentUser={currentUser} actionUsers={actionActors.users} actionUsersLoading={actionActors.loading} actorUserId={actorUserId} onActorUserId={setActorUserId} onLocation={(value) => { setSelectedLocation(value); setSelectedDrawer(""); }} onDrawer={(value) => { setSelectedDrawer(value); setSelectedLocation(""); }} onSave={() => void saveLocation()} onRescan={() => { setPiece(null); setScanning(true); }} />}
      </div>
    </section>
    <div aria-hidden="true" className="w-full shrink-0 sm:hidden" style={{ height: "calc(4.25rem + env(safe-area-inset-bottom))" }} />
  </div>;
}

function ActionMenu({ onAction, onClose }: { onAction: (action: QuickAction) => void; onClose: () => void }) {
  return <div className="grid grid-cols-2 gap-3">
    <QuickButton icon={<MapPin />} title="Escanear y ubicar" text="Elegir hueco o cajón" tone="emerald" onClick={() => onAction("locate")} />
    <QuickButton icon={<ShoppingBag />} title="Escanear y vender" text="Registrar la venta" tone="amber" onClick={() => onAction("sell")} />
    <QuickButton icon={<Images />} title="Abrir fotografías" text="Ver o subir imágenes" tone="cyan" onClick={() => onAction("photos")} />
    <QuickButton icon={<ScanBarcode />} title="Ubicación en serie" text="Mismo cajón o nivel" tone="violet" onClick={() => onAction("series")} />
    <Link onClick={onClose} href="/almacen-desguace/nueva" className="col-span-2 flex min-h-16 items-center gap-3 rounded-2xl border border-zinc-700 bg-zinc-900 p-4 text-left"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500 text-zinc-950"><Plus /></span><span><strong className="block text-white">Registrar una pieza nueva</strong><small className="text-zinc-500">Abrir el formulario completo</small></span></Link>
  </div>;
}

function QuickButton({ icon, title, text, tone, onClick }: { icon: React.ReactNode; title: string; text: string; tone: "emerald" | "amber" | "cyan" | "violet"; onClick: () => void }) {
  const colors = { emerald: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300", amber: "border-amber-500/30 bg-amber-500/10 text-amber-300", cyan: "border-cyan-500/30 bg-cyan-500/10 text-cyan-300", violet: "border-violet-500/30 bg-violet-500/10 text-violet-300" };
  return <button type="button" onClick={onClick} className={`min-h-32 rounded-2xl border p-4 text-left active:scale-95 ${colors[tone]}`}><span className="[&>svg]:h-7 [&>svg]:w-7">{icon}</span><strong className="mt-3 block text-sm text-white">{title}</strong><small className="mt-1 block leading-4 opacity-75">{text}</small></button>;
}

function LocationPanel({ piece, series, loading, saving, locations, drawers, selectedLocation, selectedDrawer, lastDestination, currentUser, actionUsers, actionUsersLoading, actorUserId, onActorUserId, onLocation, onDrawer, onSave, onRescan }: { piece: PiezaDesguace; series: boolean; loading: boolean; saving: boolean; locations: FreeLocation[]; drawers: CajonDesguace[]; selectedLocation: string; selectedDrawer: string; lastDestination: LastDestination | null; currentUser: AppUser | null; actionUsers: AppUser[]; actionUsersLoading: boolean; actorUserId: string; onActorUserId: (value: string) => void; onLocation: (value: string) => void; onDrawer: (value: string) => void; onSave: () => void; onRescan: () => void }) {
  const selectedLocationData = locations.find((item) => item.ubicacion === selectedLocation);
  const selectedDrawerData = drawers.find((item) => item.id === Number(selectedDrawer));
  return <div className="space-y-4">
    <button onClick={onRescan} className="inline-flex items-center gap-1 text-sm font-bold text-zinc-400"><ChevronLeft size={17} /> Escanear otra pieza</button>
    <section className="rounded-2xl border border-zinc-700 bg-zinc-900 p-4"><p className="font-mono text-xs font-black text-amber-300">{piece.codigo_interno}</p><h3 className="mt-1 text-lg font-black text-white">{piece.nombre_pieza || "Pieza sin nombre"}</h3><p className="mt-1 text-xs text-zinc-500">{piece.ubicacion ? `Actualmente en ${piece.ubicacion}` : piece.cajon ? `Actualmente en ${piece.cajon.codigo}` : "Actualmente sin ubicación"}</p></section>
    {series && lastDestination && <div className="rounded-xl border border-violet-500/25 bg-violet-500/10 p-3 text-sm text-violet-200"><strong>Modo serie:</strong> {lastDestination.kind === "drawer" ? `se repetirá ${lastDestination.label} mientras tenga espacio.` : "se ha seleccionado el siguiente hueco libre del mismo nivel."}</div>}
    {selectedLocation && <ActionActorSelect currentUser={currentUser} users={actionUsers} loading={actionUsersLoading} value={actorUserId} onChange={onActorUserId} label="Quién coloca la pieza" />}
    {loading ? <div className="flex min-h-40 items-center justify-center gap-2 text-zinc-400"><Loader2 className="animate-spin text-cyan-400" /> Buscando destinos disponibles...</div> : <>
      <label className="block"><span className="mb-1.5 flex items-center gap-2 text-sm font-black text-emerald-200"><Warehouse size={17} /> Estantería y hueco</span><select value={selectedLocation} onChange={(event) => onLocation(event.target.value)} className="min-h-12 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 text-white"><option value="">Elegir un hueco libre</option>{locations.map((item) => <option key={item.ubicacion} value={item.ubicacion}>{item.estanteria_codigo} · Nivel {item.nivel} · Hueco {item.hueco} · {item.zona}</option>)}</select></label>
      <div className="flex items-center gap-3 text-xs text-zinc-600"><span className="h-px flex-1 bg-zinc-800" />O GUARDAR EN CAJÓN<span className="h-px flex-1 bg-zinc-800" /></div>
      <label className="block"><span className="mb-1.5 flex items-center gap-2 text-sm font-black text-cyan-200"><Archive size={17} /> Cajón</span><select value={selectedDrawer} onChange={(event) => onDrawer(event.target.value)} className="min-h-12 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 text-white"><option value="">Elegir un cajón con espacio</option>{drawers.map((drawer) => <option key={drawer.id} value={drawer.id}>{drawer.codigo} · {drawer.nombre} · {drawer.disponibles} libres</option>)}</select></label>
      {(selectedLocationData || selectedDrawerData) && <div className="rounded-xl border border-amber-500/25 bg-amber-500/10 p-3"><p className="text-xs font-bold text-amber-300">Destino elegido</p><p className="mt-1 font-mono text-sm font-black text-white">{selectedDrawerData ? `${selectedDrawerData.codigo} · ${selectedDrawerData.ubicacion}` : selectedLocationData?.ubicacion}</p></div>}
      <button disabled={saving || (!selectedLocation && !selectedDrawer)} onClick={onSave} className="inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-5 py-4 text-base font-black text-zinc-950 shadow-lg shadow-emerald-950/30 active:scale-[0.98] disabled:opacity-40">{saving ? <Loader2 className="animate-spin" size={21} /> : <PackagePlus size={22} />} {series ? "Guardar y continuar" : "Guardar ubicación"}</button>
    </>}
  </div>;
}

function SuccessPanel({ message, series, onNext, onFinish }: { message: string; series: boolean; onNext: () => void; onFinish: () => void }) {
  return <div className="py-8 text-center"><span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500 text-zinc-950"><CheckCircle2 size={34} /></span><h3 className="mt-4 text-xl font-black text-white">Guardado correctamente</h3><p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-zinc-400">{message}</p><div className="mt-6 grid gap-2"><button onClick={onNext} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-cyan-500 px-5 font-black text-zinc-950"><ScanBarcode size={19} /> {series ? "Escanear siguiente pieza" : "Escanear otra pieza"}</button><button onClick={onFinish} className="min-h-11 rounded-xl border border-zinc-700 font-bold text-zinc-300">{series ? "Terminar serie" : "Cerrar"}</button></div></div>;
}
