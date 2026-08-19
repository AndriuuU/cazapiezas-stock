/* eslint-disable @next/next/no-img-element */
"use client";

import { useRef, useState } from "react";
import { Camera, Check, Copy, Loader2, Star, Trash2, Upload } from "lucide-react";
import ConfirmDialog from "@/components/almacen-desguace/ConfirmDialog";
import { useCurrentUser } from "@/components/auth/useCurrentUser";
import { useWarehouseSettings } from "@/components/auth/useWarehouseSettings";
import { PHOTO_SOURCE_MAX_BYTES } from "@/lib/photo-upload";
import { optimizePhoto, uploadPiecePhoto } from "@/lib/photo-upload-client";
import type { FotoDesguace } from "@/types/almacen-desguace";

export default function PhotoManager({ piezaId, initialPhotos }: { piezaId: number; initialPhotos: FotoDesguace[] }) {
  const currentUser = useCurrentUser();
  const isAdmin = currentUser?.rol === "administrador";
  const settings = useWarehouseSettings();
  const canUpload = isAdmin || settings.employeesCanUploadPhotos;
  const canChooseMain = isAdmin || settings.employeesCanChooseMainPhoto;
  const [photos, setPhotos] = useState(initialPhotos);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [uploadProgress, setUploadProgress] = useState("");
  const [photoToRemove, setPhotoToRemove] = useState<FotoDesguace | null>(null);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const input = useRef<HTMLInputElement>(null);

  async function upload() {
    const selected = Array.from(input.current?.files || []);
    if (!selected.length) return;
    const files = selected.filter((file) => file.type.startsWith("image/") && file.size <= PHOTO_SOURCE_MAX_BYTES);
    if (!files.length) {
      setError("Selecciona imágenes válidas de hasta 30 MB cada una.");
      if (input.current) input.current.value = "";
      return;
    }
    setBusy(true); setError("");
    if (files.length !== selected.length) setError("Alguna imagen no era válida o superaba los 30 MB y no se ha incluido.");
    try {
      for (let index = 0; index < files.length; index++) {
        setUploadProgress(`Optimizando ${index + 1} de ${files.length}...`);
        const optimized = await optimizePhoto(files[index]);
        setUploadProgress(`Subiendo ${index + 1} de ${files.length}...`);
        await uploadPiecePhoto(piezaId, optimized);
      }
      window.location.reload();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudieron subir las fotografías.");
    } finally {
      setBusy(false);
      setUploadProgress("");
      if (input.current) input.current.value = "";
    }
  }
  async function makeMain(id: number) {
    setBusy(true); setError("");
    const response = await fetch(`/api/almacen-desguace/${piezaId}/fotos`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ foto_id: id, es_principal: true }) });
    const data = await response.json();
    if (!response.ok) setError(data.error); else setPhotos(current => current.map(photo => ({ ...photo, es_principal: photo.id === id })));
    setBusy(false);
  }
  async function remove(photo: FotoDesguace) {
    setBusy(true); setError("");
    const response = await fetch(`/api/almacen-desguace/${piezaId}/fotos?foto_id=${photo.id}`, { method: "DELETE" });
    const data = await response.json();
    if (!response.ok) setError(data.error); else window.location.reload();
    setBusy(false);
  }
  async function copyPublicUrl(photo: FotoDesguace) {
    if (!photo.url_publica) return;
    try {
      const check = await fetch(photo.url_publica, { method: "HEAD", cache: "no-store" });
      if (!check.ok) throw new Error("El bucket de fotografías todavía no está configurado como público.");
      await navigator.clipboard.writeText(photo.url_publica);
      setCopiedId(photo.id);
      window.setTimeout(() => setCopiedId((current) => current === photo.id ? null : current), 1800);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "No se pudo copiar el enlace público."); }
  }
  return (
    <section id="fotografias" className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><h2 className="flex items-center gap-2 text-lg font-bold text-white"><Camera size={20} className="text-amber-400" /> Fotografías</h2><p className="text-sm text-zinc-500">Puedes seleccionar varias. Se optimizan y suben una por una; la estrella identifica la principal.</p></div>{canUpload && <label className={`inline-flex items-center gap-2 rounded-xl bg-amber-500 px-4 py-2 font-bold text-zinc-950 ${busy ? "cursor-wait opacity-60" : "cursor-pointer hover:bg-amber-400"}`}><input ref={input} type="file" accept="image/*" multiple disabled={busy} className="hidden" onChange={() => void upload()} />{busy ? <Loader2 className="animate-spin" size={17} /> : <Upload size={17} />} {uploadProgress || "Subir fotos"}</label>}</div>
      {error && <p className="mb-3 rounded-lg bg-red-500/10 p-3 text-sm text-red-300">{error}</p>}
      {photos.length ? <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-5">{photos.map(photo => <div key={photo.id} className={`group relative overflow-hidden rounded-xl border ${photo.es_principal ? "border-amber-400" : "border-zinc-700"}`}><img src={photo.url_visualizacion} alt="Pieza" className="aspect-square w-full object-cover" /><div className="absolute inset-x-0 bottom-0 flex justify-end gap-1 bg-gradient-to-t from-black/90 p-2 pt-8"><button onClick={() => void copyPublicUrl(photo)} title="Copiar enlace público" className="rounded-lg bg-black/60 p-2 text-cyan-300">{copiedId === photo.id ? <Check size={16} /> : <Copy size={16} />}</button>{canChooseMain && <button disabled={busy || photo.es_principal} onClick={() => void makeMain(photo.id)} title="Hacer principal" className="rounded-lg bg-black/60 p-2 text-amber-300 disabled:opacity-40"><Star size={16} fill={photo.es_principal ? "currentColor" : "none"} /></button>}{isAdmin && <button disabled={busy} onClick={() => setPhotoToRemove(photo)} title="Eliminar" className="rounded-lg bg-black/60 p-2 text-red-300"><Trash2 size={16} /></button>}</div></div>)}</div> : <div className="rounded-xl border border-dashed border-zinc-700 py-10 text-center text-zinc-500">Todavía no hay fotografías.</div>}
      {photoToRemove && <ConfirmDialog title="¿Eliminar esta fotografía?" description="La imagen se eliminará definitivamente de la pieza y no podrá recuperarse." confirmLabel="Sí, eliminar" tone="red" onConfirm={() => remove(photoToRemove)} onClose={() => setPhotoToRemove(null)} />}
    </section>
  );
}
