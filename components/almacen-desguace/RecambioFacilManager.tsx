"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2, CircleHelp, CloudCog, CloudOff, Loader2, RefreshCw, ShieldCheck, Trash2,
} from "lucide-react";
import ConfirmDialog from "@/components/almacen-desguace/ConfirmDialog";
import PublishRecambioFacilButton from "@/components/almacen-desguace/PublishRecambioFacilButton";
import type { PiezaDesguace } from "@/types/almacen-desguace";

type RemoteSummary = {
  Codigo?: unknown;
  Descripcion?: unknown;
  Referencia?: unknown;
  Precio?: unknown;
  PrecioPVP?: unknown;
  Marca?: unknown;
  Modelo?: unknown;
  Ubicacion?: unknown;
  UbicacionEstanteria?: unknown;
  Imagenes?: unknown;
  [key: string]: unknown;
};

const REMOTE_LABELS: Record<string, string> = {
  Codigo: "Código R/F",
  Idcliente: "Cliente",
  Referencia: "Referencia",
  Referencia2: "Referencia 2",
  Referencia3: "Referencia 3",
  Descripcion: "Nombre publicado",
  Stock: "Stock",
  Precio: "Precio calculado",
  PrecioPVP: "Precio PVP",
  PrecioPM: "Precio PM",
  PrecioPUE: "Precio PUE",
  Estado: "Estado",
  ImporteCasco: "Importe casco",
  ClaveDescuento: "Clave descuento",
  Fechabase: "Fecha base",
  FechaUltimaEntrada: "Última entrada",
  FechaUltimaSalida: "Última salida",
  FechaUltimoMovimiento: "Último movimiento",
  Ubicacion: "Ubicación",
  UbicacionEstanteria: "Ubicación estantería",
  Almacen: "Almacén",
  Peso: "Peso",
  Observaciones: "Observaciones",
  Marca: "Marca",
  Modelo: "Modelo",
  Puertas: "Puertas",
  Kilometraje: "Kilometraje",
  Vehiculo: "Vehículo",
  Bastidor: "Bastidor",
  Matricula: "Matrícula",
  CodigoMotor: "Código motor",
  Combustible: "Combustible",
  Color: "Color",
  AnoStock: "Año stock",
  Familia: "Familia",
  Articulo: "Artículo",
  ModeloInicio: "Modelo desde",
  ModeloFin: "Modelo hasta",
  Version: "Versión",
  CodigoCambio: "Código cambio",
  AnoVehiculo: "Año vehículo",
  Imagenes: "Imágenes",
  Sede: "Sede",
};

type ManagementResponse = {
  exists?: boolean;
  updated?: boolean;
  deleted?: boolean;
  alreadyAbsent?: boolean;
  externalCode?: string;
  remote?: RemoteSummary | null;
  local?: { publicado_online?: boolean; estado_proceso?: string };
  message?: string;
  error?: string;
};

type Confirmation = "update" | "delete" | null;

export default function RecambioFacilManager({ piece }: { piece: PiezaDesguace }) {
  const router = useRouter();
  const [verified, setVerified] = useState(false);
  const [exists, setExists] = useState(piece.publicado_online);
  const [externalCode, setExternalCode] = useState(piece.codigo_recambio_facil || "");
  const [remote, setRemote] = useState<RemoteSummary | null>(null);
  const [busy, setBusy] = useState<"check" | "update" | "delete" | null>(null);
  const [confirmation, setConfirmation] = useState<Confirmation>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function request(method: "GET" | "PUT" | "DELETE") {
    const operation = method === "GET" ? "check" : method === "PUT" ? "update" : "delete";
    setBusy(operation);
    setMessage("");
    setError("");
    try {
      const response = await fetch(`/api/almacen-desguace/recambio-facil/gestionar/${piece.id}`, {
        method,
        headers: { Accept: "application/json" },
        cache: "no-store",
      });
      const data = await response.json() as ManagementResponse;
      if (!response.ok) throw new Error(data.error || "Recambio Fácil no confirmó la operación.");
      const nextExists = method === "DELETE" ? false : method === "PUT" ? true : Boolean(data.exists);
      setVerified(true);
      setExists(nextExists);
      setExternalCode(data.externalCode || externalCode);
      setRemote(nextExists ? data.remote || remote : null);
      setMessage(data.message || "Operación completada correctamente.");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo completar la operación en Recambio Fácil.");
    } finally {
      setBusy(null);
    }
  }

  const status = verified
    ? exists
      ? { title: "Publicación comprobada", detail: "Recambio Fácil confirma que esta pieza existe.", style: "border-emerald-500/30 bg-emerald-500/10 text-emerald-200", icon: <ShieldCheck size={22} /> }
      : { title: "No está publicada", detail: "Recambio Fácil no encuentra esta pieza.", style: "border-zinc-700 bg-zinc-950 text-zinc-300", icon: <CloudOff size={22} /> }
    : piece.publicado_online
      ? { title: "Marcada Online en Cazapiezas", detail: "Todavía no se ha comprobado ahora mismo con R/F.", style: "border-cyan-500/30 bg-cyan-500/10 text-cyan-200", icon: <CircleHelp size={22} /> }
      : { title: "No consta Online en Cazapiezas", detail: "Comprueba R/F por si ya estuviera publicada.", style: "border-zinc-700 bg-zinc-950 text-zinc-300", icon: <CircleHelp size={22} /> };

  return <section id="recambio-facil" className="scroll-mt-5 overflow-hidden rounded-2xl border border-violet-500/25 bg-zinc-900">
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-zinc-800 p-5">
      <div>
        <p className="text-xs font-black uppercase tracking-wider text-violet-300">Recambio Fácil</p>
        <h2 className="mt-1 text-xl font-black text-white">Comprobar y gestionar la publicación</h2>
        <p className="mt-1 max-w-2xl text-sm text-zinc-500">Aquí puedes verificar el estado real, actualizar los datos publicados o retirar únicamente el anuncio de R/F.</p>
      </div>
      {externalCode && <div className="rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-right"><p className="text-[10px] font-bold uppercase text-zinc-500">Código guardado de R/F</p><p className="font-mono font-black text-amber-300">{externalCode}</p></div>}
    </div>

    <div className="space-y-4 p-5">
      <div className={`flex items-start gap-3 rounded-xl border p-4 ${status.style}`}>
        <span className="mt-0.5 shrink-0">{status.icon}</span>
        <div><p className="font-black">{status.title}</p><p className="mt-0.5 text-sm opacity-75">{status.detail}</p></div>
      </div>

      {message && <div role="status" className="flex items-start gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm font-semibold text-emerald-200"><CheckCircle2 className="mt-0.5 shrink-0" size={17} /><span>{message}</span></div>}
      {error && <div role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm font-semibold text-red-200">{error}</div>}

      {verified && exists && remote && <RemotePieceSummary remote={remote} />}

      <div className="grid gap-2 sm:flex sm:flex-wrap">
        <button onClick={() => void request("GET")} disabled={busy !== null} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-violet-500/40 bg-violet-500/10 px-4 py-2.5 font-black text-violet-100 hover:bg-violet-500/20 disabled:opacity-50">
          {busy === "check" ? <Loader2 className="animate-spin" size={18} /> : <RefreshCw size={18} />} Comprobar en R/F
        </button>
        {verified && exists && <>
          <button onClick={() => setConfirmation("update")} disabled={busy !== null} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-cyan-500 px-4 py-2.5 font-black text-zinc-950 hover:bg-cyan-400 disabled:opacity-50">
            {busy === "update" ? <Loader2 className="animate-spin" size={18} /> : <CloudCog size={18} />} Actualizar con los datos actuales
          </button>
          <button onClick={() => setConfirmation("delete")} disabled={busy !== null} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-2.5 font-black text-red-200 hover:bg-red-500/20 disabled:opacity-50">
            {busy === "delete" ? <Loader2 className="animate-spin" size={18} /> : <Trash2 size={18} />} Eliminar solo de R/F
          </button>
        </>}
        {!exists && piece.estado_proceso !== "Vendida" && piece.estado_proceso !== "Retirada" && <PublishRecambioFacilButton piezaId={piece.id} codigo={piece.codigo_interno} />}
      </div>

      <p className="text-xs leading-5 text-zinc-500"><strong className="text-zinc-300">Importante:</strong> eliminar de R/F no borra la pieza de Cazapiezas, no la retira del almacén y no modifica su estantería o cajón.</p>
    </div>

    {confirmation === "update" && <ConfirmDialog
      title="¿Actualizar esta pieza en Recambio Fácil?"
      description="Se sustituirán los datos publicados por la descripción, precio, referencias, vehículo, ubicación e imágenes que tenga actualmente la pieza en Cazapiezas."
      confirmLabel="Sí, actualizar R/F"
      onConfirm={() => request("PUT")}
      onClose={() => setConfirmation(null)}
    />}
    {confirmation === "delete" && <ConfirmDialog
      title="¿Eliminar esta pieza de Recambio Fácil?"
      description="Se retirará el anuncio de R/F. La pieza seguirá en Cazapiezas y conservará su ubicación, fotografías e historial."
      confirmLabel="Sí, eliminar solo de R/F"
      tone="red"
      onConfirm={() => request("DELETE")}
      onClose={() => setConfirmation(null)}
    />}
  </section>;
}

function RemotePieceSummary({ remote }: { remote: RemoteSummary }) {
  const price = remote.PrecioPVP ?? remote.Precio;
  const vehicle = [remote.Marca, remote.Modelo].filter(Boolean).join(" ");
  const images = countRemoteImages(remote.Imagenes);
  const hiddenFields = new Set(["Referencia", "Precio", "PrecioPVP", "Marca", "Modelo", "Imagenes", "Descripcion", "Stock", "Estado"]);
  const additional = Object.entries(remote).filter(([field, value]) => !hiddenFields.has(field) && hasRemoteValue(value));
  return <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4">
    <p className="mb-3 text-xs font-black uppercase tracking-wide text-emerald-300">Datos que devuelve Recambio Fácil</p>
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      <RemoteField label="Referencia" value={remote.Referencia} mono />
      <RemoteField label="Precio" value={formatRemotePrice(price)} />
      <RemoteField label="Stock" value={remote.Stock} />
      <RemoteField label="Estado" value={remote.Estado} />
      <RemoteField label="Vehículo" value={vehicle} />
      <RemoteField label="Imágenes" value={images ? `${images} publicadas` : "Sin imágenes indicadas"} />
    </div>
    {remote.Descripcion !== null && remote.Descripcion !== undefined && <div className="mt-3 rounded-xl bg-zinc-950/70 p-3"><p className="text-[10px] font-bold uppercase text-zinc-600">Nombre publicado en R/F</p><p className="mt-1 text-sm font-bold text-zinc-300">{String(remote.Descripcion)}</p></div>}
    {additional.length > 0 && <details className="mt-3 rounded-xl border border-zinc-800 bg-zinc-950/50 p-3">
      <summary className="cursor-pointer text-sm font-black text-cyan-300">Ver todos los datos devueltos · {additional.length}</summary>
      <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {additional.map(([field, value]) => <RemoteField key={field} label={REMOTE_LABELS[field] || field} value={formatRemoteValue(field, value)} mono={field === "Codigo" || field.startsWith("Referencia") || field === "Matricula" || field === "Bastidor" || field.startsWith("Codigo")} />)}
      </div>
    </details>}
  </div>;
}

function RemoteField({ label, value, mono = false }: { label: string; value: unknown; mono?: boolean }) {
  return <div className="min-w-0 rounded-xl bg-zinc-950/70 px-3 py-2"><p className="text-[10px] font-bold uppercase text-zinc-600">{label}</p><p className={`mt-1 truncate text-sm font-bold text-zinc-200 ${mono ? "font-mono" : ""}`}>{value === null || value === undefined || value === "" ? "Sin indicar" : String(value)}</p></div>;
}

function hasRemoteValue(value: unknown) {
  return value !== null && value !== undefined && value !== "";
}

function formatRemotePrice(value: unknown) {
  if (!hasRemoteValue(value)) return null;
  const number = Number(value);
  return Number.isFinite(number) ? `${number.toFixed(2)} €` : String(value);
}

function formatRemoteValue(field: string, value: unknown) {
  if (!hasRemoteValue(value)) return null;
  if (["Precio", "PrecioPVP", "PrecioPM", "PrecioPUE", "ImporteCasco"].includes(field)) return formatRemotePrice(value);
  if (field.startsWith("Fecha") && typeof value === "string") {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return new Intl.DateTimeFormat("es-ES", { dateStyle: "medium" }).format(parsed);
  }
  return value;
}

function countRemoteImages(value: unknown) {
  if (Array.isArray(value)) return value.filter(Boolean).length;
  if (typeof value !== "string" || !value.trim()) return 0;
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) return parsed.filter(Boolean).length;
  } catch { /* Algunas respuestas utilizan una lista separada por comas. */ }
  return value.split(",").map((item) => item.trim()).filter(Boolean).length;
}
