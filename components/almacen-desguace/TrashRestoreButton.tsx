"use client";

import { useState } from "react";
import { Loader2, RotateCcw } from "lucide-react";

export default function TrashRestoreButton({ eventId }: { eventId: number }) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  async function restore() {
    setLoading(true); setMessage("");
    try {
      const response = await fetch(`/api/almacen-desguace/papelera/${eventId}`, { method: "POST" });
      const data = await response.json() as { message?: string; error?: string };
      if (!response.ok) throw new Error(data.error || "No se pudo recuperar.");
      setMessage(data.message || "Pieza recuperada.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "No se pudo recuperar."); }
    finally { setLoading(false); }
  }
  return <div className="text-right"><button disabled={loading || Boolean(message)} onClick={() => void restore()} className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-3 py-2 text-sm font-black text-zinc-950 disabled:opacity-50">{loading ? <Loader2 className="animate-spin" size={16} /> : <RotateCcw size={16} />} Recuperar</button>{message && <p className="mt-2 max-w-xs text-xs text-zinc-400">{message}</p>}</div>;
}
