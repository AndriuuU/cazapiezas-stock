"use client";

import { useEffect, useRef, useState } from "react";
import { CalendarDays, CircleDollarSign, Loader2, Plus, Settings2, ShoppingBag, Trash2, UserRound, X } from "lucide-react";
import type { PiezaDesguace } from "@/types/almacen-desguace";

function localDateTimeNow() {
  const date = new Date();
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
}

const FALLBACK_EMPLOYEES = ["Andrés", "Santi", "Fran"];

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
  const [employee, setEmployee] = useState("Andrés");
  const [employees, setEmployees] = useState<string[]>(FALLBACK_EMPLOYEES);
  const [employeeDraft, setEmployeeDraft] = useState<string[]>(FALLBACK_EMPLOYEES);
  const [newEmployee, setNewEmployee] = useState("");
  const [managingEmployees, setManagingEmployees] = useState(false);
  const [employeesLoading, setEmployeesLoading] = useState(true);
  const [employeesSaving, setEmployeesSaving] = useState(false);
  const [price, setPrice] = useState(piece.precio_venta == null ? "" : Number(piece.precio_venta).toFixed(2));
  const [paymentMethod, setPaymentMethod] = useState("Recambio Fácil");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const dateInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let active = true;
    void fetch("/api/employees", { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json() as { employees?: string[] };
        if (!response.ok) throw new Error();
        const loaded = data.employees?.length ? data.employees : FALLBACK_EMPLOYEES;
        if (active) {
          setEmployees(loaded);
          setEmployeeDraft(loaded);
          setEmployee((current) => loaded.includes(current) ? current : loaded[0] || "");
        }
      })
      .catch(() => undefined)
      .finally(() => { if (active) setEmployeesLoading(false); });
    return () => { active = false; };
  }, []);

  async function addEmployee() {
    const name = newEmployee.trim().replace(/\s+/g, " ");
    if (!name) return;
    if (employeeDraft.some((item) => item.toLocaleLowerCase("es") === name.toLocaleLowerCase("es"))) {
      setError("Ese empleado ya está registrado.");
      return;
    }
    await saveEmployees([...employeeDraft, name], name);
  }

  async function saveEmployees(nextEmployees = employeeDraft, preferredEmployee?: string) {
    if (!nextEmployees.length) {
      setError("Debe quedar al menos un empleado activo.");
      return;
    }
    setEmployeesSaving(true);
    setError("");
    try {
      const response = await fetch("/api/employees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employees: nextEmployees }),
      });
      const data = await response.json() as { employees?: string[]; error?: string };
      if (!response.ok) throw new Error(data.error || "No se pudieron guardar los empleados.");
      const saved = data.employees || nextEmployees;
      setEmployees(saved);
      setEmployeeDraft(saved);
      setEmployee((current) => preferredEmployee && saved.includes(preferredEmployee) ? preferredEmployee : saved.includes(current) ? current : saved[0] || "");
      setNewEmployee("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudieron guardar los empleados.");
    } finally {
      setEmployeesSaving(false);
    }
  }

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
          forma_pago: paymentMethod,
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
    <div className="fixed inset-0 flex flex-col items-center justify-end bg-black/75 backdrop-blur-lg sm:justify-center sm:p-6" style={{ zIndex: 240 }} onMouseDown={(event) => { if (!saving && event.target === event.currentTarget) onClose(); }}>
      <form onSubmit={(event) => void submit(event)} className="flex max-h-full w-full max-w-lg flex-col overflow-hidden rounded-t-3xl border border-zinc-700 bg-zinc-950 shadow-2xl sm:max-h-[calc(100dvh-3rem)] sm:rounded-3xl">
        <header className="flex items-start gap-3 border-b border-zinc-800 p-5">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-500 text-zinc-950"><ShoppingBag size={22} /></span>
          <div className="min-w-0 flex-1">
            <h2 className="text-xl font-black text-white">Registrar venta</h2>
            <p className="mt-1 truncate font-mono text-xs font-bold text-amber-300">{piece.codigo_interno} · {piece.nombre_pieza || "Pieza sin nombre"}</p>
          </div>
          <button type="button" disabled={saving} onClick={onClose} aria-label="Cerrar" className="rounded-xl p-2 text-zinc-500 hover:bg-zinc-800 hover:text-white disabled:opacity-40"><X size={21} /></button>
        </header>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain p-5 pb-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm font-bold text-zinc-300">
              <span className="mb-2 flex items-center gap-2"><CalendarDays size={17} className="text-cyan-300" /> Fecha y hora</span>
              <div style={{ position: "relative" }}>
                <input ref={dateInputRef} required type="datetime-local" value={date} max={localDateTimeNow()} onChange={(event) => setDate(event.target.value)} className="sale-date-input w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-3 pr-12 text-white [color-scheme:dark] outline-none focus:border-cyan-500" />
                <button type="button" aria-label="Abrir calendario" onClick={() => dateInputRef.current?.showPicker()} className="flex items-center justify-center rounded-lg text-white hover:bg-white/10 active:bg-white/15" style={{ position: "absolute", top: "0.25rem", right: "0.25rem", bottom: "0.25rem", width: "2.5rem", zIndex: 10 }}>
                  <CalendarDays aria-hidden="true" size={20} strokeWidth={2.2} />
                </button>
              </div>
            </label>
            <label className="block text-sm font-bold text-zinc-300">
              <span className="mb-2 flex items-center gap-2"><CircleDollarSign size={17} className="text-emerald-300" /> Precio sin IVA</span>
              <div className="relative"><input required type="number" min="0" max="999999.99" step="0.01" value={price} onChange={(event) => setPrice(event.target.value)} className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-3 pr-10 text-white outline-none focus:border-emerald-500" /><span className="absolute right-3 top-3 text-zinc-500">€</span></div>
            </label>
          </div>

          <label className="block text-sm font-bold text-zinc-300">
            <span className="mb-2 flex items-center gap-2"><UserRound size={17} className="text-amber-300" /> Empleado</span>
            <div className="flex gap-2">
              <select required disabled={employeesLoading} value={employee} onChange={(event) => setEmployee(event.target.value)} className="min-w-0 flex-1 rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-3 text-white outline-none focus:border-amber-500 disabled:opacity-50">
                <option value="">{employeesLoading ? "Cargando empleados…" : "Selecciona un empleado"}</option>
                {employees.map((name) => <option key={name} value={name}>{name}</option>)}
              </select>
              <button type="button" onClick={() => { setEmployeeDraft(employees); setManagingEmployees((current) => !current); setError(""); }} className="inline-flex items-center gap-2 rounded-xl border border-zinc-700 px-3 text-zinc-300 hover:border-amber-500/50 hover:text-amber-300" title="Añadir o quitar empleados"><Settings2 size={18} /><span className="hidden sm:inline">Gestionar</span></button>
            </div>
          </label>

          {managingEmployees && <section className="flex max-h-[min(32rem,calc(100dvh-8rem))] flex-col overflow-hidden rounded-2xl border border-amber-500/25 bg-amber-500/5 p-4">
            <div className="mb-3 flex shrink-0 items-start justify-between gap-3"><div><h3 className="font-black text-white">Empleados activos</h3><p className="mt-1 text-xs text-zinc-500">Los que quites no aparecerán en ventas nuevas. Sus ventas anteriores se conservarán.</p></div><button type="button" disabled={employeesSaving} onClick={() => setManagingEmployees(false)} aria-label="Cerrar gestión de empleados" className="shrink-0 rounded-lg border border-zinc-700 p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-white disabled:opacity-40"><X size={18} /></button></div>
            <div className="min-h-0 space-y-2 overflow-y-auto overscroll-contain pr-1">
              {employeeDraft.map((name) => <div key={name} className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2.5"><span className="font-semibold text-zinc-200">{name}</span><button type="button" disabled={employeeDraft.length === 1 || employeesSaving} onClick={() => void saveEmployees(employeeDraft.filter((item) => item !== name))} className="rounded-lg p-1.5 text-zinc-500 hover:bg-red-500/10 hover:text-red-300 disabled:cursor-not-allowed disabled:opacity-25" aria-label={`Quitar a ${name}`} title={employeeDraft.length === 1 ? "Debe quedar al menos un empleado" : `Quitar a ${name}`}><Trash2 size={17} /></button></div>)}
            </div>
            <div className="mt-3 flex shrink-0 gap-2"><input maxLength={100} disabled={employeesSaving} value={newEmployee} onChange={(event) => setNewEmployee(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); void addEmployee(); } }} placeholder="Nombre del nuevo empleado" className="min-w-0 flex-1 rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-white outline-none focus:border-amber-500 disabled:opacity-50" /><button type="button" disabled={employeesSaving || !newEmployee.trim()} onClick={() => void addEmployee()} className="inline-flex items-center gap-1.5 rounded-xl bg-amber-500 px-3 font-black text-zinc-950 hover:bg-amber-400 disabled:opacity-50">{employeesSaving ? <Loader2 className="animate-spin" size={17} /> : <Plus size={17} />} Añadir</button></div>
            <div className="mt-3 flex shrink-0 items-center justify-between gap-2"><p className="text-xs font-semibold text-emerald-300">Los cambios se guardan automáticamente.</p><button type="button" disabled={employeesSaving} onClick={() => setManagingEmployees(false)} className="rounded-lg bg-white px-3 py-2 text-sm font-black text-zinc-950 disabled:opacity-50">Cerrar</button></div>
          </section>}

          <label className="block text-sm font-bold text-zinc-300">
            <span className="mb-2 block">Forma de pago</span>
            <select required value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)} className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-3 text-white outline-none focus:border-emerald-500"><option>Recambio Fácil</option><option>Efectivo</option><option>Tarjeta</option><option>Transferencia</option><option>Bizum</option><option>Contra reembolso</option><option>Otra</option></select>
          </label>

          <label className="block text-sm font-bold text-zinc-300">
            <span className="mb-2 block">Observaciones <small className="font-normal text-zinc-600">(opcional)</small></span>
            <textarea rows={2} maxLength={2000} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Cliente, incidencia, descuento…" className="min-h-20 w-full resize-none rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-3 text-white outline-none focus:border-amber-500 sm:min-h-24 sm:resize-y" />
            <span className="mt-1 block text-right text-xs font-normal text-zinc-600">{notes.length}/2000</span>
          </label>

          {error && <p role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm font-semibold text-red-200">{error}</p>}
        </div>

        <footer className="flex shrink-0 gap-2 border-t border-zinc-800 bg-zinc-900/95 p-3 sm:justify-end sm:p-4">
          <button type="button" disabled={saving} onClick={onClose} className="min-w-0 flex-1 rounded-xl border border-zinc-700 px-3 py-3 font-bold text-zinc-300 hover:bg-zinc-800 disabled:opacity-40 sm:flex-none sm:px-4 sm:py-2.5">Cancelar</button>
          <button type="submit" disabled={saving || employeesLoading || managingEmployees} className="inline-flex min-w-0 flex-[1.6] items-center justify-center gap-2 rounded-xl bg-emerald-500 px-3 py-3 font-black text-zinc-950 hover:bg-emerald-400 disabled:opacity-50 sm:flex-none sm:px-5 sm:py-2.5">{saving ? <Loader2 className="animate-spin" size={18} /> : <ShoppingBag size={18} />} Confirmar venta</button>
        </footer>
      </form>
      <div aria-hidden="true" className="w-full shrink-0 sm:hidden" style={{ height: "calc(4.25rem + env(safe-area-inset-bottom))" }} />
      <style jsx global>{`
        .sale-date-input::-webkit-calendar-picker-indicator {
          pointer-events: none;
          opacity: 0;
        }
      `}</style>
    </div>
  );
}
