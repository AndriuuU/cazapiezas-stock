"use client";

import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, Edit3, Loader2, Plus, Save, Warehouse, X } from "lucide-react";
import ModuleHeader from "@/components/almacen-desguace/ModuleHeader";
import type { EstanteriaDesguace } from "@/types/almacen-desguace";

type ShelfForm = {
  codigo: string; nombre: string; descripcion: string; categorias: string;
  palabras_clave: string; niveles: string; huecos_por_nivel: string;
  capacidad_maxima: string; llena_manual: boolean; activa: boolean;
};
const EMPTY_FORM: ShelfForm = {
  codigo: "", nombre: "", descripcion: "", categorias: "", palabras_clave: "",
  niveles: "3", huecos_por_nivel: "4", capacidad_maxima: "12",
  llena_manual: false, activa: true,
};

export default function ShelfManager() {
  const [shelves, setShelves] = useState<EstanteriaDesguace[]>([]);
  const [form, setForm] = useState<ShelfForm>(EMPTY_FORM);
  const [editing, setEditing] = useState<EstanteriaDesguace | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/almacen-desguace/estanterias");
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No se pudieron cargar las estanterías.");
      setShelves(data);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "No se pudieron cargar las estanterías."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  function openNew() { setEditing(null); setForm(EMPTY_FORM); setShowForm(true); setError(""); }
  function openEdit(shelf: EstanteriaDesguace) {
    setEditing(shelf);
    setForm({
      codigo: shelf.codigo, nombre: shelf.nombre, descripcion: shelf.descripcion || "",
      categorias: shelf.categorias.join(", "), palabras_clave: shelf.palabras_clave.join(", "),
      niveles: String(shelf.niveles), huecos_por_nivel: String(shelf.huecos_por_nivel),
      capacidad_maxima: String(shelf.capacidad_maxima), llena_manual: shelf.llena_manual, activa: shelf.activa,
    });
    setShowForm(true); setError("");
  }
  async function save(event: FormEvent) {
    event.preventDefault(); setSaving(true); setError(""); setSuccess("");
    try {
      const response = await fetch(editing ? `/api/almacen-desguace/estanterias/${editing.id}` : "/api/almacen-desguace/estanterias", {
        method: editing ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No se pudo guardar la estantería.");
      setSuccess(editing ? "Estantería actualizada." : "Estantería creada.");
      setShowForm(false); setEditing(null); await load();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "No se pudo guardar la estantería."); }
    finally { setSaving(false); }
  }
  async function quickUpdate(shelf: EstanteriaDesguace, changes: Partial<EstanteriaDesguace>) {
    setError(""); setSuccess("");
    const response = await fetch(`/api/almacen-desguace/estanterias/${shelf.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...shelf, ...changes }),
    });
    const data = await response.json();
    if (!response.ok) setError(data.error); else { setSuccess("Estantería actualizada."); await load(); }
  }

  return <main className="min-h-screen bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950">
    <ModuleHeader title="Organización de estanterías" subtitle="Reglas, capacidad y huecos disponibles" />
    <div className="mx-auto max-w-7xl space-y-5 px-4 py-6 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/almacen-desguace" className="inline-flex items-center gap-2 text-sm font-semibold text-zinc-400 hover:text-white"><ArrowLeft size={17} /> Volver a las piezas</Link>
        <button onClick={openNew} className="inline-flex items-center gap-2 rounded-xl bg-amber-500 px-4 py-2.5 font-bold text-zinc-950 hover:bg-amber-400"><Plus size={18} /> Nueva estantería</button>
      </div>
      <section className="rounded-2xl border border-cyan-500/20 bg-cyan-500/5 p-4 text-sm text-cyan-100">
        Define categorías o palabras que aparecen en el nombre de la pieza. Si dejas ambas vacías, la estantería funcionará como espacio general para piezas sin coincidencia específica.
      </section>
      {error && <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">{error}</div>}
      {success && <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-300">{success}</div>}
      {loading ? <div className="flex justify-center gap-2 py-16 text-zinc-400"><Loader2 className="animate-spin" /> Cargando...</div> : shelves.length === 0 ? <div className="rounded-2xl border border-dashed border-zinc-700 py-16 text-center"><Warehouse className="mx-auto mb-3 text-zinc-700" size={48} /><p className="font-bold text-zinc-300">Todavía no hay estanterías configuradas.</p><p className="mt-1 text-sm text-zinc-500">Crea la primera para empezar a recibir sugerencias.</p></div> : <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{shelves.map((shelf) => <ShelfCard key={shelf.id} shelf={shelf} onEdit={() => openEdit(shelf)} onToggleFull={() => void quickUpdate(shelf, { llena_manual: !shelf.llena_manual })} onToggleActive={() => void quickUpdate(shelf, { activa: !shelf.activa })} />)}</div>}
    </div>
    {showForm && <ShelfFormModal form={form} setForm={setForm} editing={editing} saving={saving} onSubmit={save} onClose={() => setShowForm(false)} />}
  </main>;
}

function ShelfCard({ shelf, onEdit, onToggleFull, onToggleActive }: { shelf: EstanteriaDesguace; onEdit: () => void; onToggleFull: () => void; onToggleActive: () => void }) {
  const barClass = shelf.llena ? "bg-red-500" : shelf.porcentaje_ocupacion >= 80 ? "bg-amber-500" : "bg-emerald-500";
  return <article className={`rounded-2xl border bg-zinc-900 p-5 ${shelf.llena ? "border-red-500/30" : "border-zinc-800"}`}>
    <div className="flex items-start justify-between gap-3"><div><p className="font-mono text-sm font-black text-amber-300">{shelf.codigo}</p><h2 className="text-xl font-bold text-white">{shelf.nombre}</h2><p className="mt-1 text-sm text-zinc-500">{shelf.descripcion || "Sin descripción"}</p></div>{shelf.llena ? <span className="rounded-full bg-red-500/10 px-3 py-1 text-xs font-bold text-red-300">LLENA</span> : !shelf.activa ? <span className="rounded-full bg-zinc-700 px-3 py-1 text-xs text-zinc-300">INACTIVA</span> : <CheckCircle2 className="text-emerald-400" />}</div>
    <div className="mt-4"><div className="mb-1 flex justify-between text-xs text-zinc-400"><span>{shelf.ocupados} ocupados</span><span>{shelf.disponibles} libres</span></div><div className="h-2 overflow-hidden rounded-full bg-zinc-800"><div className={`h-full ${barClass}`} style={{ width: `${Math.min(shelf.porcentaje_ocupacion, 100)}%` }} /></div><p className="mt-1 text-right text-xs text-zinc-500">{shelf.porcentaje_ocupacion}% · capacidad {shelf.capacidad_maxima}</p></div>
    <div className="mt-4 grid grid-cols-2 gap-3 text-sm"><Info label="Niveles" value={shelf.niveles} /><Info label="Huecos/nivel" value={shelf.huecos_por_nivel} /><Info label="Siguiente hueco" value={shelf.siguiente_ubicacion || "Ninguno"} mono /><Info label="Estado" value={shelf.llena_manual ? "Llena manual" : shelf.llena ? "Capacidad completa" : "Disponible"} /></div>
    <div className="mt-4 space-y-2 text-xs"><Rule label="Categorías" values={shelf.categorias} /><Rule label="Palabras" values={shelf.palabras_clave} /></div>
    <div className="mt-5 flex flex-wrap gap-2"><button onClick={onEdit} className="inline-flex items-center gap-1 rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-800"><Edit3 size={15} /> Editar</button><button onClick={onToggleFull} className={`rounded-lg border px-3 py-2 text-sm ${shelf.llena_manual ? "border-emerald-500/30 text-emerald-300" : "border-red-500/30 text-red-300"}`}>{shelf.llena_manual ? "Marcar con espacio" : "Marcar llena"}</button><button onClick={onToggleActive} className="rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-400">{shelf.activa ? "Desactivar" : "Activar"}</button></div>
  </article>;
}

function ShelfFormModal({ form, setForm, editing, saving, onSubmit, onClose }: { form: ShelfForm; setForm: (form: ShelfForm) => void; editing: EstanteriaDesguace | null; saving: boolean; onSubmit: (event: FormEvent) => void; onClose: () => void }) {
  const input = "w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-white focus:border-amber-500 focus:outline-none";
  const update = (field: keyof ShelfForm, value: string | boolean) => setForm({ ...form, [field]: value });
  return <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 p-4 backdrop-blur-sm md:items-center"><form onSubmit={onSubmit} className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-zinc-700 bg-zinc-900 p-5 shadow-2xl"><div className="mb-5 flex items-center justify-between"><div><h2 className="text-xl font-bold text-white">{editing ? `Editar ${editing.codigo}` : "Nueva estantería"}</h2><p className="text-sm text-zinc-500">Configura qué piezas debe recibir y su capacidad.</p></div><button type="button" onClick={onClose} className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-800"><X /></button></div><div className="grid gap-4 md:grid-cols-2"><Label text="Código"><input required pattern="E[0-9]{2}" value={form.codigo} onChange={(e) => update("codigo", e.target.value.toUpperCase())} placeholder="E01" className={input} /></Label><Label text="Nombre / qué contiene"><input required value={form.nombre} onChange={(e) => update("nombre", e.target.value)} placeholder="Faros y pilotos" className={input} /></Label><Label text="Descripción" wide><textarea value={form.descripcion} onChange={(e) => update("descripcion", e.target.value)} rows={2} className={input} /></Label><Label text="Categorías (separadas por comas)" wide><input value={form.categorias} onChange={(e) => update("categorias", e.target.value)} placeholder="Iluminación, Carrocería" className={input} /></Label><Label text="Palabras clave (separadas por comas)" wide><input value={form.palabras_clave} onChange={(e) => update("palabras_clave", e.target.value)} placeholder="faro, piloto, antiniebla" className={input} /></Label><Label text="Niveles"><input type="number" min="1" max="99" value={form.niveles} onChange={(e) => update("niveles", e.target.value)} className={input} /></Label><Label text="Huecos por nivel"><input type="number" min="1" max="99" value={form.huecos_por_nivel} onChange={(e) => update("huecos_por_nivel", e.target.value)} className={input} /></Label><Label text="Capacidad máxima"><input type="number" min="1" value={form.capacidad_maxima} onChange={(e) => update("capacidad_maxima", e.target.value)} className={input} /></Label><div className="flex flex-col justify-end gap-2"><label className="flex items-center gap-2 text-sm text-zinc-300"><input type="checkbox" checked={form.activa} onChange={(e) => update("activa", e.target.checked)} className="accent-amber-500" /> Estantería activa</label><label className="flex items-center gap-2 text-sm text-zinc-300"><input type="checkbox" checked={form.llena_manual} onChange={(e) => update("llena_manual", e.target.checked)} className="accent-red-500" /> Bloquear como llena</label></div></div><div className="mt-6 flex justify-end"><button disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-amber-500 px-5 py-3 font-bold text-zinc-950 disabled:opacity-50">{saving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />} Guardar estantería</button></div></form></div>;
}

function Label({ text, wide, children }: { text: string; wide?: boolean; children: ReactNode }) { return <label className={wide ? "md:col-span-2" : ""}><span className="mb-1.5 block text-sm text-zinc-400">{text}</span>{children}</label>; }
function Info({ label, value, mono }: { label: string; value: ReactNode; mono?: boolean }) { return <div><p className="text-xs text-zinc-500">{label}</p><p className={`text-zinc-200 ${mono ? "font-mono text-xs" : "font-semibold"}`}>{value}</p></div>; }
function Rule({ label, values }: { label: string; values: string[] }) { return <div><span className="text-zinc-500">{label}: </span>{values.length ? values.map((value) => <span key={value} className="mr-1 inline-block rounded bg-zinc-800 px-2 py-1 text-zinc-300">{value}</span>) : <span className="text-zinc-600">General</span>}</div>; }
