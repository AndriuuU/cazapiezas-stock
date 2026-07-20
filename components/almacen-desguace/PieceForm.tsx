"use client";

/* eslint-disable @next/next/no-img-element */
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Camera, ImagePlus, Loader2, Save, X } from "lucide-react";
import { ESTADOS_PIEZA, ESTADOS_PROCESO, type PiezaDesguace } from "@/types/almacen-desguace";
import LocationField from "@/components/almacen-desguace/LocationField";

const fields = [
  ["nombre_pieza", "Nombre de la pieza"], ["descripcion", "Descripción"], ["categoria", "Categoría"],
  ["marca_pieza", "Marca de la pieza"], ["referencia_principal", "Referencia principal"],
  ["referencia_oem", "Referencia OEM"], ["referencias_equivalentes", "Referencias equivalentes"],
  ["marca_vehiculo", "Marca del vehículo"], ["modelo_vehiculo", "Modelo del vehículo"],
  ["motorizacion", "Motorización"], ["codigo_motor", "Código motor"], ["procedencia", "Procedencia"],
] as const;

export default function PieceForm({ pieza }: { pieza?: PiezaDesguace }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [saving, setSaving] = useState(false);
  const [savingStep, setSavingStep] = useState("");
  const [error, setError] = useState("");
  const [pendingPhotos, setPendingPhotos] = useState<File[]>([]);
  const [createdPieceId, setCreatedPieceId] = useState<number | null>(null);
  const [uploadedPhotoCount, setUploadedPhotoCount] = useState(0);

  async function uploadPhotos(pieceId: number) {
    if (!pendingPhotos.length) return;
    setSavingStep(`Subiendo ${pendingPhotos.length} fotografía${pendingPhotos.length === 1 ? "" : "s"}...`);
    const photosForm = new FormData();
    pendingPhotos.forEach((file) => photosForm.append("fotos", file));
    const response = await fetch(`/api/almacen-desguace/${pieceId}/fotos`, { method: "POST", body: photosForm });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "No se pudieron subir las fotografías.");
    setUploadedPhotoCount((current) => current + pendingPhotos.length);
    setPendingPhotos([]);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const payload = Object.fromEntries(form.entries()) as Record<string, FormDataEntryValue | boolean>;
    payload.publicado_online = form.get("publicado_online") === "on";
    const publishState = payload.estado_proceso === "Lista para publicar" || payload.estado_proceso === "Publicada";
    if (publishState) {
      const missing = [
        !String(payload.nombre_pieza || "").trim() && "nombre",
        !String(payload.referencia_principal || "").trim() && !String(payload.referencia_oem || "").trim() && "referencia",
        !String(payload.estado_pieza || "").trim() && "estado",
        !String(payload.precio_venta || "").trim() && "precio",
        !String(payload.ubicacion || "").trim() && "ubicación",
        !String(payload.cantidad || "").trim() && "cantidad",
        !((pieza?.fotos?.length || 0) + uploadedPhotoCount + pendingPhotos.length) && "al menos una fotografía",
      ].filter(Boolean);
      if (missing.length) { setError(`Para publicar faltan: ${missing.join(", ")}.`); return; }
    }
    setSaving(true); setSavingStep("Guardando datos..."); setError("");
    try {
      let pieceId = pieza?.id || createdPieceId || undefined;
      if (!pieceId) {
        const initialPayload = publishState && pendingPhotos.length
          ? { ...payload, estado_proceso: "Pendiente de fotografiar", publicado_online: false }
          : payload;
        const createResponse = await fetch("/api/almacen-desguace", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(initialPayload) });
        const created = await createResponse.json() as PiezaDesguace & { error?: string };
        if (!createResponse.ok) throw new Error(created.error || "No se pudo guardar.");
        pieceId = created.id;
        setCreatedPieceId(pieceId);
        await uploadPhotos(pieceId);
        if (publishState && pendingPhotos.length) {
          setSavingStep("Comprobando requisitos de publicación...");
          const publishResponse = await fetch(`/api/almacen-desguace/${pieceId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
          const published = await publishResponse.json() as PiezaDesguace & { error?: string };
          if (!publishResponse.ok) throw new Error(published.error || "La pieza se guardó, pero no se pudo publicar.");
        }
      } else {
        if (publishState && pendingPhotos.length) await uploadPhotos(pieceId);
        setSavingStep("Guardando datos...");
        const updateResponse = await fetch(`/api/almacen-desguace/${pieceId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
        const updated = await updateResponse.json() as PiezaDesguace & { error?: string };
        if (!updateResponse.ok) throw new Error(updated.error || "No se pudo guardar.");
        if (!publishState && pendingPhotos.length) await uploadPhotos(pieceId);
      }
      router.push(`/almacen-desguace/${pieceId}`);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo guardar.");
    } finally { setSaving(false); setSavingStep(""); }
  }

  const value = (name: keyof PiezaDesguace) => pieza?.[name] ?? "";
  const inputClass = "w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-white placeholder:text-zinc-600 focus:border-amber-500 focus:outline-none";
  return (
    <form ref={formRef} onSubmit={submit} className="space-y-6">
      <Link href="/almacen-desguace" className="inline-flex items-center gap-2 rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-2.5 text-sm font-bold text-zinc-300 hover:border-amber-500/40 hover:text-amber-300"><ArrowLeft size={17} /> Volver a Almacén Desguace</Link>
      {error && <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">{error}</div>}
      <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
        <h2 className="mb-4 text-lg font-bold text-white">Datos e identificación</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {fields.map(([name, label]) => (
            <label key={name} className={name === "descripcion" || name === "referencias_equivalentes" ? "md:col-span-2" : ""}>
              <span className="mb-1.5 block text-sm font-medium text-zinc-400">{label}</span>
              {name === "descripcion" || name === "referencias_equivalentes" ?
                <textarea name={name} defaultValue={String(value(name))} rows={3} className={inputClass} /> :
                <input name={name} defaultValue={String(value(name))} className={inputClass} />}
            </label>
          ))}
        </div>
      </section>
      <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
        <h2 className="mb-4 text-lg font-bold text-white">Estado, cantidades y ubicación</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Field label="Estado de la pieza"><select name="estado_pieza" defaultValue={String(value("estado_pieza"))} className={inputClass}><option value="">Sin completar</option>{ESTADOS_PIEZA.map(v => <option key={v}>{v}</option>)}</select></Field>
          <Field label="Estado del proceso"><select name="estado_proceso" defaultValue={String(value("estado_proceso") || "Pendiente de identificar")} className={inputClass}>{ESTADOS_PROCESO.map(v => <option key={v}>{v}</option>)}</select></Field>
          <Field label="Cantidad"><input name="cantidad" type="number" min="0" step="1" defaultValue={String(value("cantidad"))} className={inputClass} /></Field>
          <LocationField initialValue={pieza?.ubicacion} formRef={formRef} />
          <Field label="Precio de coste"><input name="precio_coste" type="number" min="0" step="0.01" defaultValue={String(value("precio_coste"))} className={inputClass} /></Field>
          <Field label="Precio de venta"><input name="precio_venta" type="number" min="0" step="0.01" defaultValue={String(value("precio_venta"))} className={inputClass} /></Field>
          <Field label="Año desde"><input name="ano_desde" type="number" min="1900" max="2100" defaultValue={String(value("ano_desde"))} className={inputClass} /></Field>
          <Field label="Año hasta"><input name="ano_hasta" type="number" min="1900" max="2100" defaultValue={String(value("ano_hasta"))} className={inputClass} /></Field>
          <Field label="Fecha de entrada"><input name="fecha_entrada" type="date" defaultValue={String(value("fecha_entrada") || new Date().toISOString().slice(0, 10))} className={inputClass} /></Field>
          <label className="flex items-center gap-3 self-end rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-sm text-zinc-300"><input name="publicado_online" type="checkbox" defaultChecked={pieza?.publicado_online} className="h-4 w-4 accent-amber-500" /> Publicada online</label>
        </div>
        <p className="mt-4 text-xs text-zinc-500">Puedes guardar cualquier campo incompleto como borrador. Al elegir “Lista para publicar” o “Publicada” se comprobarán automáticamente todos los requisitos.</p>
      </section>
      <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="flex items-center gap-2 text-lg font-bold text-white"><Camera className="text-cyan-400" size={20} /> Fotografías</h2><p className="text-sm text-zinc-500">Puedes seleccionarlas ahora, incluso antes de crear la pieza.</p></div><label className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-cyan-500 px-4 py-2.5 font-bold text-zinc-950 hover:bg-cyan-400"><ImagePlus size={18} /> Añadir fotos<input type="file" accept="image/*" multiple className="hidden" onChange={(event) => { const files = Array.from(event.currentTarget.files || []); const valid = files.filter((file) => file.type.startsWith("image/") && file.size <= 10 * 1024 * 1024); if (valid.length !== files.length) setError("Solo se permiten imágenes de hasta 10 MB."); setPendingPhotos((current) => [...current, ...valid]); event.currentTarget.value = ""; }} /></label></div>
        {pieza?.fotos?.length ? <p className="mt-3 text-sm text-emerald-300">Esta pieza ya tiene {pieza.fotos.length} fotografía{pieza.fotos.length === 1 ? "" : "s"} guardada{pieza.fotos.length === 1 ? "" : "s"}.</p> : null}
        {pendingPhotos.length ? <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">{pendingPhotos.map((file, index) => <PendingPhoto key={`${file.name}-${file.lastModified}-${index}`} file={file} onRemove={() => setPendingPhotos((current) => current.filter((_, photoIndex) => photoIndex !== index))} />)}</div> : <div className="mt-4 rounded-xl border border-dashed border-zinc-700 py-8 text-center text-sm text-zinc-500">No has añadido fotografías nuevas.</div>}
      </section>
      <div className="flex flex-wrap items-center justify-end gap-3">{savingStep && <span className="text-sm text-zinc-400">{savingStep}</span>}<button disabled={saving} className="inline-flex min-w-44 items-center justify-center gap-2 rounded-xl bg-amber-500 px-5 py-3 font-bold text-zinc-950 hover:bg-amber-400 disabled:opacity-50">{saving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />} Guardar pieza</button></div>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label><span className="mb-1.5 block text-sm font-medium text-zinc-400">{label}</span>{children}</label>;
}

function PendingPhoto({ file, onRemove }: { file: File; onRemove: () => void }) {
  const [preview] = useState(() => URL.createObjectURL(file));
  useEffect(() => () => URL.revokeObjectURL(preview), [preview]);
  return <div className="relative overflow-hidden rounded-xl border border-zinc-700 bg-zinc-950"><img src={preview} alt={file.name} className="aspect-square w-full object-cover" /><button type="button" onClick={onRemove} title="Quitar fotografía" className="absolute right-1.5 top-1.5 rounded-full bg-black/70 p-1.5 text-white hover:bg-red-500"><X size={15} /></button><p className="truncate px-2 py-1.5 text-[10px] text-zinc-500">{file.name}</p></div>;
}
