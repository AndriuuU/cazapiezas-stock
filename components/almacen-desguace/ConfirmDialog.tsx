"use client";

import { useState } from "react";
import { AlertTriangle, CheckCircle2, Loader2, X } from "lucide-react";

type ConfirmDialogProps = {
  title: string;
  description: string;
  confirmLabel?: string;
  tone?: "amber" | "red";
  onConfirm: () => void | Promise<void>;
  onClose: () => void;
};

export default function ConfirmDialog({ title, description, confirmLabel = "Confirmar", tone = "amber", onConfirm, onClose }: ConfirmDialogProps) {
  const [confirming, setConfirming] = useState(false);

  async function accept() {
    setConfirming(true);
    try { await onConfirm(); }
    finally { setConfirming(false); onClose(); }
  }

  const destructive = tone === "red";
  return <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm" onMouseDown={(event) => { if (!confirming && event.target === event.currentTarget) onClose(); }}>
    <div role="alertdialog" aria-modal="true" aria-labelledby="confirm-dialog-title" aria-describedby="confirm-dialog-description" className="w-full max-w-md overflow-hidden rounded-2xl border border-zinc-700 bg-zinc-950 shadow-2xl">
      <div className="flex items-start gap-3 p-5">
        <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${destructive ? "bg-red-500/15 text-red-400" : "bg-amber-500/15 text-amber-400"}`}>{destructive ? <AlertTriangle size={23} /> : <CheckCircle2 size={23} />}</span>
        <div className="min-w-0 flex-1"><h2 id="confirm-dialog-title" className="text-lg font-bold text-white">{title}</h2><p id="confirm-dialog-description" className="mt-1 text-sm leading-6 text-zinc-400">{description}</p></div>
        <button disabled={confirming} onClick={onClose} title="Cerrar" className="rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-800 hover:text-white disabled:opacity-40"><X size={19} /></button>
      </div>
      <div className="flex flex-col-reverse gap-2 border-t border-zinc-800 bg-zinc-900/60 p-4 sm:flex-row sm:justify-end">
        <button disabled={confirming} onClick={onClose} className="rounded-xl border border-zinc-700 px-4 py-2.5 font-semibold text-zinc-300 hover:bg-zinc-800 disabled:opacity-40">Cancelar</button>
        <button disabled={confirming} onClick={() => void accept()} className={`inline-flex items-center justify-center gap-2 rounded-xl px-5 py-2.5 font-bold disabled:opacity-50 ${destructive ? "bg-red-500 text-white hover:bg-red-400" : "bg-amber-500 text-zinc-950 hover:bg-amber-400"}`}>{confirming && <Loader2 className="animate-spin" size={17} />}{confirmLabel}</button>
      </div>
    </div>
  </div>;
}
