"use client";

/* eslint-disable @next/next/no-img-element */
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Camera, CloudDownload, CloudUpload, ImagePlus, Loader2, Save, X } from "lucide-react";
import { ESTADOS_PIEZA, ESTADOS_PROCESO, type PiezaDesguace, type PiezaDesguaceInput } from "@/types/almacen-desguace";
import ConfirmDialog from "@/components/almacen-desguace/ConfirmDialog";
import LocationField from "@/components/almacen-desguace/LocationField";
import { RECAMBIO_FACIL_REFERENCE_MIN_LENGTH, validateRecambioFacilRequiredFields } from "@/lib/recambio-facil-rules";

type PublicationResponse = {
  published?: Array<{ id: number }>;
  skipped?: Array<{ id: number; reason?: string }>;
  failed?: Array<{ error?: string }>;
  error?: string;
};

type ImportResponse = {
  code?: string;
  piece?: PiezaDesguaceInput;
  photoUrls?: string[];
  message?: string;
  error?: string;
  existingId?: number;
};

const fields = [
  ["nombre_pieza", "Nombre de la pieza"], ["descripcion", "Observaciones / descripción adicional"], ["categoria", "Categoría"],
  ["marca_pieza", "Marca de la pieza"], ["referencia_principal", "Referencia principal"],
  ["referencia_oem", "Referencia OEM"], ["referencias_equivalentes", "Referencias equivalentes"],
  ["marca_vehiculo", "Marca del vehículo"], ["modelo_vehiculo", "Modelo del vehículo"], ["matricula_vehiculo", "Matrícula del vehículo"],
  ["motorizacion", "Motorización"], ["codigo_motor", "Código motor"], ["procedencia", "Procedencia"],
] as const;

export default function PieceForm({ pieza }: { pieza?: PiezaDesguace }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const errorRef = useRef<HTMLDivElement>(null);
  const submitModeRef = useRef<"save" | "save-and-publish">("save");
  const [saving, setSaving] = useState(false);
  const [savingStep, setSavingStep] = useState("");
  const [error, setError] = useState("");
  const [confirmingPublication, setConfirmingPublication] = useState(false);
  const [pendingPhotos, setPendingPhotos] = useState<File[]>([]);
  const [importedPhotoUrls, setImportedPhotoUrls] = useState<string[]>([]);
  const [importedPiece, setImportedPiece] = useState<PiezaDesguaceInput | null>(null);
  const [importCode, setImportCode] = useState("");
  const [importing, setImporting] = useState(false);
  const [importMessage, setImportMessage] = useState("");
  const [existingImportId, setExistingImportId] = useState<number | null>(null);
  const [formVersion, setFormVersion] = useState(0);
  const [createdPieceId, setCreatedPieceId] = useState<number | null>(null);
  const [principalReference, setPrincipalReference] = useState(String(pieza?.referencia_principal || ""));

  useEffect(() => {
    if (error) errorRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [error]);

  async function uploadPhotos(pieceId: number) {
    if (!pendingPhotos.length) return;
    setSavingStep(`Subiendo ${pendingPhotos.length} fotografía${pendingPhotos.length === 1 ? "" : "s"}...`);
    const photosForm = new FormData();
    pendingPhotos.forEach((file) => photosForm.append("fotos", file));
    const response = await fetch(`/api/almacen-desguace/${pieceId}/fotos`, { method: "POST", body: photosForm });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "No se pudieron subir las fotografías.");
    setPendingPhotos([]);
  }

  async function attachImportedPhotos(pieceId: number) {
    if (!importedPhotoUrls.length) return;
    setSavingStep(`Guardando ${importedPhotoUrls.length} fotografía${importedPhotoUrls.length === 1 ? "" : "s"} de R/F...`);
    const response = await fetch(`/api/almacen-desguace/${pieceId}/fotos`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ urls: importedPhotoUrls }),
    });
    const data = await response.json() as { error?: string };
    if (!response.ok) throw new Error(data.error || "No se pudieron guardar las fotografías de Recambio Fácil.");
    setImportedPhotoUrls([]);
  }

  async function importFromRecambioFacil() {
    const code = importCode.trim();
    if (!code) {
      setError("Escribe el identificador de Recambio Fácil.");
      return;
    }
    setImporting(true);
    setError("");
    setImportMessage("");
    setExistingImportId(null);
    try {
      const response = await fetch("/api/almacen-desguace/recambio-facil/importar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ codigo: code }),
      });
      const data = await response.json() as ImportResponse;
      if (!response.ok || !data.piece) {
        if (data.existingId) setExistingImportId(data.existingId);
        throw new Error(data.error || "Recambio Fácil no devolvió los datos de la pieza.");
      }
      setImportedPiece(data.piece);
      setPrincipalReference(String(data.piece.referencia_principal || ""));
      setImportedPhotoUrls(data.photoUrls || []);
      setPendingPhotos([]);
      setImportCode(data.code || code);
      setImportMessage(data.message || "Datos importados. Revísalos antes de guardar.");
      setFormVersion((version) => version + 1);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo importar la pieza desde Recambio Fácil.");
    } finally {
      setImporting(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const publishAfterSave = submitModeRef.current === "save-and-publish";
    submitModeRef.current = "save";
    const form = new FormData(event.currentTarget);
    const payload = Object.fromEntries(form.entries()) as Record<string, FormDataEntryValue | boolean>;
    const recambioFacilMissing = validateRecambioFacilRequiredFields({ nombrePieza: payload.nombre_pieza, precio: payload.precio_venta, referenciaPrincipal: payload.referencia_principal, marca: payload.marca_vehiculo, modelo: payload.modelo_vehiculo });
    if (publishAfterSave && recambioFacilMissing.length) {
      setError(`No se puede publicar en R/F. Revisa: ${recambioFacilMissing.join(", ")}.`);
      return;
    }
    setSaving(true); setSavingStep("Guardando datos..."); setError("");
    try {
      let pieceId = pieza?.id || createdPieceId || undefined;
      if (!pieceId) {
        const createResponse = await fetch("/api/almacen-desguace", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
        const created = await createResponse.json() as PiezaDesguace & { error?: string };
        if (!createResponse.ok) throw new Error(created.error || "No se pudo guardar.");
        pieceId = created.id;
        setCreatedPieceId(pieceId);
      } else {
        setSavingStep("Guardando datos...");
        const updateResponse = await fetch(`/api/almacen-desguace/${pieceId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
        const updated = await updateResponse.json() as PiezaDesguace & { error?: string };
        if (!updateResponse.ok) throw new Error(updated.error || "No se pudo guardar.");
      }
      if (importedPhotoUrls.length) await attachImportedPhotos(pieceId);
      if (pendingPhotos.length) await uploadPhotos(pieceId);

      if (publishAfterSave) {
        setSavingStep("Publicando en Recambio Fácil...");
        try {
          const publishResponse = await fetch("/api/almacen-desguace/recambio-facil/publicar", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: pieceId }),
          });
          const publication = await publishResponse.json() as PublicationResponse;
          const published = publication.published?.some((item) => item.id === pieceId);
          const alreadyOnline = publication.skipped?.some((item) => item.id === pieceId);
          if (!published && !alreadyOnline) {
            throw new Error(publication.failed?.[0]?.error || publication.error || "Recambio Fácil no confirmó el alta.");
          }
        } catch (publicationError) {
          const detail = publicationError instanceof Error ? publicationError.message : "No se pudo conectar con Recambio Fácil.";
          router.push(`/almacen-desguace/${pieceId}?rf_error=${encodeURIComponent(detail.slice(0, 700))}`);
          router.refresh();
          return;
        }
      }

      router.push(`/almacen-desguace/${pieceId}`);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo guardar.");
    } finally { setSaving(false); setSavingStep(""); }
  }

  const value = (name: keyof PiezaDesguace) => {
    const importedValue = importedPiece?.[name as keyof PiezaDesguaceInput];
    return importedValue ?? pieza?.[name] ?? "";
  };
  const inputClass = "min-w-0 max-w-full w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-white placeholder:text-zinc-600 focus:border-amber-500 focus:outline-none";
  const referenceLength = principalReference.trim().length;
  const referenceInvalid = referenceLength > 0 && referenceLength < RECAMBIO_FACIL_REFERENCE_MIN_LENGTH;
  const importedOnline = Boolean(importedPiece?.publicado_online);
  const showPublishButton = !pieza && !importedOnline;

  function requestPublicationConfirmation() {
    const currentForm = formRef.current;
    if (!currentForm) return;
    const data = new FormData(currentForm);
    const missing = validateRecambioFacilRequiredFields({ nombrePieza: data.get("nombre_pieza"), precio: data.get("precio_venta"), referenciaPrincipal: data.get("referencia_principal"), marca: data.get("marca_vehiculo"), modelo: data.get("modelo_vehiculo") });
    if (missing.length) {
      setError(`Antes de publicar en R/F, revisa: ${missing.join(", ")}.`);
      return;
    }
    setError("");
    setConfirmingPublication(true);
  }

  return (
    <form key={formVersion} ref={formRef} onSubmit={submit} className="space-y-6 pb-24">
      <Link href="/almacen-desguace" className="inline-flex items-center gap-2 rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-2.5 text-sm font-bold text-zinc-300 hover:border-amber-500/40 hover:text-amber-300"><ArrowLeft size={17} /> Volver a Almacén Desguace</Link>
      {!pieza && <section className="rounded-2xl border border-violet-500/30 bg-violet-500/5 p-4 sm:p-5">
        <div className="flex items-start gap-3"><span className="rounded-xl bg-violet-500/15 p-2.5 text-violet-300"><CloudDownload size={22} /></span><div><h2 className="font-black text-white">Importar desde Recambio Fácil</h2><p className="mt-1 text-sm text-zinc-400">Escribe el identificador que utiliza R/F, por ejemplo <span className="font-mono font-bold text-amber-300">scaf5z</span>. Encontraremos la pieza y rellenaremos el formulario.</p></div></div>
        <div className="mt-4 flex min-w-0 flex-col gap-2 sm:flex-row">
          <input value={importCode} onChange={(event) => setImportCode(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); void importFromRecambioFacil(); } }} autoCapitalize="none" autoCorrect="off" spellCheck={false} placeholder="Identificador de R/F" aria-label="Identificador de Recambio Fácil" className="min-h-12 min-w-0 flex-1 rounded-xl border border-zinc-700 bg-zinc-950 px-4 font-mono text-white placeholder:text-zinc-600 focus:border-violet-400 focus:outline-none" />
          <button type="button" disabled={importing || !importCode.trim()} onClick={() => void importFromRecambioFacil()} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-violet-500 px-5 font-black text-white hover:bg-violet-400 disabled:opacity-40">{importing ? <Loader2 className="animate-spin" size={18} /> : <CloudDownload size={18} />}{importing ? "Buscando..." : "Buscar e importar"}</button>
        </div>
        {importMessage && <p role="status" className="mt-3 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-2.5 text-sm font-semibold text-emerald-200">{importMessage}{importedPhotoUrls.length ? ` Se han encontrado ${importedPhotoUrls.length} fotografía${importedPhotoUrls.length === 1 ? "" : "s"}.` : ""}</p>}
      </section>}
      {error && <div ref={errorRef} role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300"><span>{error}</span>{existingImportId && <Link href={`/almacen-desguace/${existingImportId}`} className="shrink-0 rounded-lg bg-red-500/15 px-3 py-2 font-black text-red-100 hover:bg-red-500/25">Abrir la pieza existente</Link>}</div>}
      {importedPiece?.codigo_recambio_facil && <input type="hidden" name="codigo_recambio_facil" value={importedPiece.codigo_recambio_facil} />}
      <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
        <div className="mb-4"><h2 className="text-lg font-bold text-white">Datos e identificación</h2><p className="mt-1 text-xs text-zinc-500"><span className="font-black text-red-400">*</span> Obligatorio para publicar en Recambio Fácil.</p></div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {fields.map(([name, label]) => {
            const requiredForRf = name === "nombre_pieza" || name === "referencia_principal" || name === "marca_vehiculo" || name === "modelo_vehiculo";
            return <label key={name} className={name === "descripcion" ? "md:col-span-2" : ""}>
              {requiredForRf ? <RequiredLabel>{label}</RequiredLabel> : <span className="mb-1.5 block text-sm font-medium text-zinc-400">{label}</span>}
              {name === "descripcion" ? <textarea name={name} defaultValue={String(value(name))} rows={3} placeholder="Detalles, estado, defectos u observaciones opcionales" className={inputClass} /> : name === "referencia_principal" ? <><input name={name} value={principalReference} onChange={(event) => setPrincipalReference(event.target.value)} aria-invalid={referenceInvalid} aria-describedby="rf-reference-help" placeholder="Mínimo 4 caracteres" className={`${inputClass} ${referenceInvalid ? "border-red-500 focus:border-red-400" : ""}`} /><p id="rf-reference-help" className={`mt-1.5 text-xs ${referenceInvalid ? "font-bold text-red-300" : referenceLength >= RECAMBIO_FACIL_REFERENCE_MIN_LENGTH ? "text-emerald-300" : "text-zinc-500"}`}>{referenceLength} / {RECAMBIO_FACIL_REFERENCE_MIN_LENGTH} caracteres mínimos{referenceInvalid ? " · faltan caracteres" : referenceLength >= RECAMBIO_FACIL_REFERENCE_MIN_LENGTH ? " · correcta" : ""}</p></> : <input name={name} defaultValue={String(value(name))} className={inputClass} />}
            </label>;
          })}
        </div>
      </section>
      <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
        <h2 className="mb-4 text-lg font-bold text-white">Estado, cantidades y ubicación</h2>
        <div className="grid min-w-0 gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Field label="Estado de la pieza"><select name="estado_pieza" defaultValue={String(value("estado_pieza"))} className={inputClass}><option value="">Sin completar</option>{ESTADOS_PIEZA.map(v => <option key={v}>{v}</option>)}</select></Field>
          <Field label="Estado del proceso"><select name="estado_proceso" defaultValue={String(value("estado_proceso") || "Pendiente de identificar")} className={inputClass}>{ESTADOS_PROCESO.map(v => <option key={v} value={v}>{v === "Publicada" ? "Publicada (ya existe en R/F)" : v}</option>)}</select></Field>
          <Field label="Cantidad"><input name="cantidad" type="number" min="0" step="1" defaultValue={String(value("cantidad"))} className={inputClass} /></Field>
          <LocationField initialValue={pieza?.ubicacion} initialDrawerId={pieza?.cajon_id} initialDrawer={pieza?.cajon} formRef={formRef} />
          <Field label="Precio de coste"><input name="precio_coste" type="number" min="0" step="0.01" defaultValue={String(value("precio_coste"))} className={inputClass} /></Field>
          <label className="block min-w-0"><RequiredLabel>Precio de venta</RequiredLabel><div className="relative min-w-0"><input name="precio_venta" type="number" min="0" step="0.01" inputMode="decimal" defaultValue={String(value("precio_venta"))} placeholder="0,00" className={`${inputClass} pr-10`} /><span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 font-bold text-zinc-500">€</span></div></label>
          <Field label="Año desde"><input name="ano_desde" type="number" min="1900" max="2100" defaultValue={String(value("ano_desde"))} className={inputClass} /></Field>
          <Field label="Año hasta"><input name="ano_hasta" type="number" min="1900" max="2100" defaultValue={String(value("ano_hasta"))} className={inputClass} /></Field>
          <Field label="Fecha de entrada"><input name="fecha_entrada" type="date" defaultValue={String(value("fecha_entrada") || new Date().toISOString().slice(0, 10))} className={inputClass} /></Field>
          <div className={`min-w-0 self-end break-words rounded-xl border px-3 py-2.5 text-sm font-semibold ${pieza?.publicado_online || importedOnline ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300" : "border-zinc-700 bg-zinc-950 text-zinc-400"}`}>{pieza?.publicado_online || importedOnline ? "Online en Recambio Fácil" : pieza ? "No publicada en Recambio Fácil" : "Se publicará después de guardar"}</div>
        </div>
        <p className="mt-3 text-xs text-zinc-500">“Publicada” indica que la pieza ya existe en R/F y solo actualiza el estado interno. Para enviar una pieza nueva utiliza “Guardar y publicar en R/F”.</p>
        <p className="mt-4 text-xs text-zinc-500">Puedes guardar campos incompletos y dejar la ubicación vacía. Los requisitos de Recambio Fácil únicamente se comprueban cuando utilizas su botón de publicación.</p>
      </section>
      <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="flex items-center gap-2 text-lg font-bold text-white"><Camera className="text-cyan-400" size={20} /> Fotografías</h2><p className="text-sm text-zinc-500">Puedes seleccionarlas ahora, incluso antes de crear la pieza.</p></div><label className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-cyan-500 px-4 py-2.5 font-bold text-zinc-950 hover:bg-cyan-400"><ImagePlus size={18} /> Añadir fotos<input type="file" accept="image/*" multiple className="hidden" onChange={(event) => { const files = Array.from(event.currentTarget.files || []); const valid = files.filter((file) => file.type.startsWith("image/") && file.size <= 10 * 1024 * 1024); if (valid.length !== files.length) setError("Solo se permiten imágenes de hasta 10 MB."); setPendingPhotos((current) => [...current, ...valid]); event.currentTarget.value = ""; }} /></label></div>
        {pieza?.fotos?.length ? <p className="mt-3 text-sm text-emerald-300">Esta pieza ya tiene {pieza.fotos.length} fotografía{pieza.fotos.length === 1 ? "" : "s"} guardada{pieza.fotos.length === 1 ? "" : "s"}.</p> : null}
        {importedPhotoUrls.length ? <div className="mt-4"><p className="mb-2 text-xs font-bold uppercase tracking-wide text-violet-300">Fotografías encontradas en R/F</p><div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">{importedPhotoUrls.map((url) => <div key={url} className="relative overflow-hidden rounded-xl border border-violet-500/30 bg-zinc-950"><img src={url} alt="Fotografía importada de Recambio Fácil" className="aspect-square w-full object-cover" /><button type="button" onClick={() => setImportedPhotoUrls((current) => current.filter((item) => item !== url))} title="No importar esta fotografía" className="absolute right-1.5 top-1.5 rounded-full bg-black/75 p-1.5 text-white hover:bg-red-500"><X size={15} /></button><p className="truncate px-2 py-1.5 text-[10px] text-violet-300">Recambio Fácil</p></div>)}</div></div> : null}
        {pendingPhotos.length ? <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">{pendingPhotos.map((file, index) => <PendingPhoto key={`${file.name}-${file.lastModified}-${index}`} file={file} onRemove={() => setPendingPhotos((current) => current.filter((_, photoIndex) => photoIndex !== index))} />)}</div> : <div className="mt-4 rounded-xl border border-dashed border-zinc-700 py-8 text-center text-sm text-zinc-500">No has añadido fotografías nuevas.</div>}
      </section>
      <div
        style={{ zIndex: 30, gridTemplateColumns: showPublishButton ? "repeat(2, minmax(0, 1fr))" : "minmax(0, 1fr)" }}
        className="piece-form-actions fixed inset-x-0 grid items-center gap-2 border-t border-zinc-800 bg-zinc-950 px-3 py-2.5 shadow-[0_-12px_30px_rgba(0,0,0,0.7)] sm:flex sm:flex-wrap sm:justify-end sm:gap-3 sm:px-6"
      >
        {savingStep && <span className="col-span-full text-center text-xs text-zinc-300 sm:text-sm">{savingStep}</span>}
        <button type="submit" disabled={saving} className="inline-flex min-h-12 w-full min-w-0 items-center justify-center gap-1.5 rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-3 text-sm font-bold text-zinc-200 hover:border-amber-500/50 hover:text-amber-300 disabled:opacity-50 sm:w-auto sm:min-w-44 sm:gap-2 sm:px-5 sm:text-base">{saving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />} Guardar pieza</button>
        {showPublishButton && <button type="button" disabled={saving} onClick={requestPublicationConfirmation} className="inline-flex min-h-12 w-full min-w-0 items-center justify-center gap-1.5 rounded-xl bg-cyan-500 px-2 py-3 text-sm font-black text-zinc-950 hover:bg-cyan-400 disabled:opacity-50 sm:w-auto sm:min-w-52 sm:gap-2 sm:px-5 sm:text-base"><CloudUpload className="shrink-0" size={18} /><span className="sm:hidden">Guardar + R/F</span><span className="hidden sm:inline">Guardar y publicar en R/F</span></button>}
      </div>
      {confirmingPublication && <ConfirmDialog
        title="¿Guardar y publicar esta pieza?"
        description="Primero se guardarán los datos y las fotografías. Si todo es válido, la pieza se enviará a Recambio Fácil y quedará marcada como Online cuando la plataforma confirme el alta."
        confirmLabel="Sí, guardar y publicar"
        onConfirm={() => {
          submitModeRef.current = "save-and-publish";
          formRef.current?.requestSubmit();
        }}
        onClose={() => setConfirmingPublication(false)}
      />}
      <style jsx>{`
        .piece-form-actions {
          bottom: calc(4rem + env(safe-area-inset-bottom));
        }
        @media (min-width: 640px) {
          .piece-form-actions {
            bottom: 0;
          }
        }
      `}</style>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block min-w-0 max-w-full"><span className="mb-1.5 block text-sm font-medium text-zinc-400">{label}</span>{children}</label>;
}

function RequiredLabel({ children }: { children: React.ReactNode }) {
  return <span className="mb-1.5 block text-sm font-medium text-zinc-400">{children} <span aria-hidden="true" className="font-black text-red-400">*</span><span className="sr-only"> (obligatorio para publicar en R/F)</span></span>;
}

function PendingPhoto({ file, onRemove }: { file: File; onRemove: () => void }) {
  const [preview, setPreview] = useState("");
  useEffect(() => {
    const objectUrl = URL.createObjectURL(file);
    // La URL pertenece a un recurso externo del navegador y debe renovarse cuando cambia el archivo.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPreview(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);
  return <div className="relative overflow-hidden rounded-xl border border-zinc-700 bg-zinc-950">{preview ? <img src={preview} alt={file.name} className="aspect-square w-full object-cover" /> : <div className="aspect-square w-full animate-pulse bg-zinc-800" />}<button type="button" onClick={onRemove} title="Quitar fotografía" className="absolute right-1.5 top-1.5 rounded-full bg-black/70 p-1.5 text-white hover:bg-red-500"><X size={15} /></button><p className="truncate px-2 py-1.5 text-[10px] text-zinc-500">{file.name}</p></div>;
}
