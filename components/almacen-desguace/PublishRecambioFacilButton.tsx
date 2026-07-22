"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CloudUpload, Loader2 } from "lucide-react";
import ConfirmDialog from "@/components/almacen-desguace/ConfirmDialog";

type PublicationResponse = {
  published?: Array<{ id: number }>;
  skipped?: Array<{ id: number; reason?: string }>;
  failed?: Array<{ error: string }>;
  error?: string;
};

export default function PublishRecambioFacilButton({ piezaId, codigo }: { piezaId: number; codigo: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function publish() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/almacen-desguace/recambio-facil/publicar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: piezaId }),
      });
      const data = await response.json() as PublicationResponse;
      const published = data.published?.some((item) => item.id === piezaId);
      const alreadyExisted = data.skipped?.some((item) => item.id === piezaId);
      if (!response.ok || (!published && !alreadyExisted)) {
        throw new Error(data.failed?.[0]?.error || data.error || "Recambio Fácil no confirmó la publicación.");
      }
      router.replace(`/almacen-desguace/${piezaId}`);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo publicar en Recambio Fácil.");
    } finally {
      setLoading(false);
    }
  }

  return <div className="flex max-w-sm flex-col items-start gap-1">
    <button onClick={() => setConfirming(true)} disabled={loading} className="inline-flex items-center gap-2 rounded-xl bg-cyan-500 px-4 py-2 font-black text-zinc-950 hover:bg-cyan-400 disabled:opacity-50">
      {loading ? <Loader2 className="animate-spin" size={17} /> : <CloudUpload size={17} />} Publicar en R/F
    </button>
    {error && <span role="alert" className="text-xs text-red-300">{error}</span>}
    {confirming && <ConfirmDialog title="¿Publicar esta pieza en Recambio Fácil?" description={`${codigo} se enviará ahora. Solo quedará Online si Recambio Fácil confirma el alta.`} confirmLabel="Sí, publicar" onConfirm={publish} onClose={() => setConfirming(false)} />}
  </div>;
}
