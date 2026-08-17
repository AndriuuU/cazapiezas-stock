"use client";

import { useState } from "react";
import { CalendarDays, CircleDollarSign, Loader2, ShoppingBag, UserRound, X } from "lucide-react";
import type { PiezaDesguace } from "@/types/almacen-desguace";

function localDateTimeNow() {
  const date = new Date();
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
}

export default function SaleModal({
  piece,
  onClose,
  onSold,
}: {
  piece: PiezaDesguace;
  onClose: () => void;
  onSold: (message: string) => void;
}) {
  const [date, setDate] = useState(localDateTimeNow);
  const [employee, setEmployee] = useState("");
  const [price, setPrice] = useState(piece.precio_venta == null ? "" : Number(piece.precio_venta).toFixed(2));
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const response = await fetch(`/api/almacen-desguace/${piece.id}/venta`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fecha_venta: new Date(date).toISOString(),
          empleado: employee,
          precio_final: Number(price),
          observaciones: notes,
        }),
      });
      const data = await response.json() as { message?: string; error?: string };
      if (!response.ok) throw new Error(data.error || "No se pudo registrar la venta.");
      onSold(data.message || `${piece.codigo_interno} marcada como vendida.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo registrar la venta.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/85 backdrop-blur-sm sm:items-center sm:p-4" onMouseDown={(event) => { if (!saving && event.target === event.currentTarget) onClose(); }}>
      <form onSubmit={(event) => void submit(event)} className="max-h-[96dvh] w-full max-w-xl overflow-y-auto rounded-t-3xl border border-zinc-700 bg-zinc-950 shadow-2xl sm:rounded-3xl">
        <header className="flex items-start gap-3 border-b border-zinc-800 p-5">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-500 text-zinc-950"><ShoppingBag size={22} /></span>
          <div className="min-w-0 flex-1">
            <h2 className="text-xl font-black text-white">Registrar venta</h2>
            <p className="mt-1 truncate font-mono text-xs font-bold text-amber-300">{piece.codigo_interno} · {piece.nombre_pieza || "Pieza sin nombre"}</p>
          </div>
          <button type="button" disabled={saving} onClick={onClose} aria-label="Cerrar" className="rounded-xl p-2 text-zinc-500 hover:bg-zinc-800 hover:text-white disabled:opacity-40"><X size={21} /></button>
        </header>

        <div className="space-y-4 p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm font-bold text-zinc-300">
              <span className="mb-2 flex items-center gap-2"><CalendarDays size={17} className="text-cyan-300" /> Fecha y hora</span>
              <input required type="datetime-local" value={date} max={localDateTimeNow()} onChange={(event) => setDate(event.target.value)} className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-3 text-white outline-none focus:border-cyan-500" />
            </label>
            <label className="block text-sm font-bold text-zinc-300">
              <span className="mb-2 flex items-center gap-2"><CircleDollarSign size={17} className="text-emerald-300" /> Precio final</span>
              <div className="relative"><input required type="number" min="0" max="999999.99" step="0.01" value={price} onChange={(event) => setPrice(event.target.value)} className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-3 pr-10 text-white outline-none focus:border-emerald-500" /><span className="absolute right-3 top-3 text-zinc-500">€</span></div>
            </label>
          </div>

          <label className="block text-sm font-bold text-zinc-300">
            <span className="mb-2 flex items-center gap-2"><UserRound size={17} className="text-amber-300" /> Empleado</span>
            <input required minLength={2} maxLength={100} autoFocus value={employee} onChange={(event) => setEmployee(event.target.value)} placeholder="Nombre de quien registra la venta" className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-3 text-white outline-none focus:border-amber-500" />
          </label>

          <label className="block text-sm font-bold text-zinc-300">
            <span className="mb-2 block">Observaciones <small className="font-normal text-zinc-600">(opcional)</small></span>
            <textarea rows={4} maxLength={2000} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Forma de pago, cliente, incidencia, descuento…" className="w-full resize-y rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-3 text-white outline-none focus:border-amber-500" />
            <span className="mt-1 block text-right text-xs font-normal text-zinc-600">{notes.length}/2000</span>
          </label>

          <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-sm leading-6 text-amber-100/80">
            Al confirmar, la pieza saldrá del almacén, dejará de estar Online y liberará {piece.cajon_id ? "su espacio en el cajón" : piece.ubicacion ? `la ubicación ${piece.ubicacion}` : "cualquier ubicación asignada"}. Podrás deshacer la venta desde la pestaña Vendidas.
          </div>
          {error && <p role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm font-semibold text-red-200">{error}</p>}
        </div>

        <footer className="flex flex-col-reverse gap-2 border-t border-zinc-800 bg-zinc-900/60 p-4 sm:flex-row sm:justify-end">
          <button type="button" disabled={saving} onClick={onClose} className="rounded-xl border border-zinc-700 px-4 py-2.5 font-bold text-zinc-300 hover:bg-zinc-800 disabled:opacity-40">Cancelar</button>
          <button type="submit" disabled={saving} className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500 px-5 py-2.5 font-black text-zinc-950 hover:bg-emerald-400 disabled:opacity-50">{saving ? <Loader2 className="animate-spin" size={18} /> : <ShoppingBag size={18} />} Confirmar venta</button>
        </footer>
      </form>
    </div>
  );
}
