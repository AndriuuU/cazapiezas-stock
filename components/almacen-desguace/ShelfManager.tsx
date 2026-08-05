"use client";

import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowLeft, CheckCircle2, Edit3, Eye, Layers3, Loader2, MapPinned, Plus, Save, Trash2, Warehouse, X } from "lucide-react";
import ModuleHeader from "@/components/almacen-desguace/ModuleHeader";
import ShelfLabelButton from "@/components/almacen-desguace/ShelfLabelButton";
import type { EstanteriaDesguace, ReglaNivelEstanteria } from "@/types/almacen-desguace";

type LevelRuleForm = { nivel_desde: string; nivel_hasta: string; contenido: string; categorias: string; palabras_clave: string };
type ShelfForm = {
  codigo: string; nombre: string; descripcion: string; zona: string; orden_plano: string; niveles: string; huecos_por_nivel: string;
  capacidad_maxima: string; llena_manual: boolean; activa: boolean; reglas_nivel: LevelRuleForm[];
};

const newRule = (from = "1", to = "1"): LevelRuleForm => ({ nivel_desde: from, nivel_hasta: to, contenido: "", categorias: "", palabras_clave: "" });
const EMPTY_FORM: ShelfForm = {
  codigo: "", nombre: "", descripcion: "", zona: "Sin zona", orden_plano: "0", niveles: "4", huecos_por_nivel: "4", capacidad_maxima: "16",
  llena_manual: false, activa: true, reglas_nivel: [newRule("1", "2"), newRule("3", "4")],
};

function ruleToForm(rule: ReglaNivelEstanteria): LevelRuleForm {
  return { nivel_desde: String(rule.nivel_desde), nivel_hasta: String(rule.nivel_hasta), contenido: rule.contenido, categorias: rule.categorias.join(", "), palabras_clave: rule.palabras_clave.join(", ") };
}

export default function ShelfManager() {
  const [shelves, setShelves] = useState<EstanteriaDesguace[]>([]);
  const [form, setForm] = useState<ShelfForm>(EMPTY_FORM);
  const [editing, setEditing] = useState<EstanteriaDesguace | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [formError, setFormError] = useState("");
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

  useEffect(() => { const timer = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(timer); }, [load]);

  function openNew() { setEditing(null); setForm(EMPTY_FORM); setShowForm(true); setFormError(""); setSuccess(""); }
  function openEdit(shelf: EstanteriaDesguace) {
    setEditing(shelf);
    const legacyRule = shelf.reglas_nivel.length ? shelf.reglas_nivel : (shelf.categorias.length || shelf.palabras_clave.length ? [{ nivel_desde: 1, nivel_hasta: shelf.niveles, contenido: shelf.nombre, categorias: shelf.categorias, palabras_clave: shelf.palabras_clave }] : []);
    setForm({
      codigo: shelf.codigo, nombre: shelf.nombre, descripcion: shelf.descripcion || "", zona: shelf.zona || "Sin zona", orden_plano: String(shelf.orden_plano || 0), niveles: String(shelf.niveles),
      huecos_por_nivel: String(shelf.huecos_por_nivel), capacidad_maxima: String(shelf.capacidad_maxima),
      llena_manual: shelf.llena_manual, activa: shelf.activa, reglas_nivel: legacyRule.map(ruleToForm),
    });
    setShowForm(true); setFormError(""); setSuccess("");
  }

  async function save(event: FormEvent) {
    event.preventDefault(); setSaving(true); setFormError(""); setSuccess("");
    try {
      const payload = { ...form, categorias: [], palabras_clave: [] };
      const response = await fetch(editing ? `/api/almacen-desguace/estanterias/${editing.id}` : "/api/almacen-desguace/estanterias", {
        method: editing ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No se pudo guardar la estantería.");
      setSuccess(editing ? "Estantería actualizada." : "Estantería creada.");
      setShowForm(false); setEditing(null); await load();
    } catch (caught) { setFormError(caught instanceof Error ? caught.message : "No se pudo guardar la estantería."); }
    finally { setSaving(false); }
  }

  async function quickUpdate(shelf: EstanteriaDesguace, changes: Partial<EstanteriaDesguace>) {
    setError(""); setSuccess("");
    try {
      const response = await fetch(`/api/almacen-desguace/estanterias/${shelf.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...shelf, ...changes }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No se pudo actualizar la estantería.");
      setSuccess("Estantería actualizada."); await load();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "No se pudo actualizar la estantería."); }
  }

  return <main className="min-h-screen bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950">
    <ModuleHeader title="Organización de estanterías" subtitle="Decide qué piezas van en cada grupo de niveles" />
    <div className="mx-auto max-w-7xl space-y-5 px-4 py-6 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/almacen-desguace" className="inline-flex items-center gap-2 text-sm font-semibold text-zinc-400 hover:text-white"><ArrowLeft size={17} /> Volver a las piezas</Link>
        <div className="flex flex-wrap gap-2"><Link href="/almacen-desguace/plano" className="inline-flex items-center gap-2 rounded-xl border border-cyan-500/30 bg-cyan-500/5 px-4 py-2.5 font-bold text-cyan-200 hover:bg-cyan-500/10"><MapPinned size={18} /> Ver plano general</Link><button onClick={openNew} className="inline-flex items-center gap-2 rounded-xl bg-amber-500 px-4 py-2.5 font-bold text-zinc-950 hover:bg-amber-400"><Plus size={18} /> Nueva estantería</button></div>
      </div>
      <section className="rounded-2xl border border-cyan-500/20 bg-cyan-500/5 p-4 text-sm text-cyan-100"><strong>Ejemplo:</strong> crea un grupo para los niveles 1–2 y escribe “Faros”; después otro para los niveles 3–4 y escribe “Retrovisores”. Al ubicar una pieza, el sistema buscará un hueco en los niveles que correspondan.</section>
      {error && <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">{error}</div>}
      {success && <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-300">{success}</div>}
      {loading ? <div className="flex justify-center gap-2 py-16 text-zinc-400"><Loader2 className="animate-spin" /> Cargando...</div> : shelves.length === 0 ? <div className="rounded-2xl border border-dashed border-zinc-700 py-16 text-center"><Warehouse className="mx-auto mb-3 text-zinc-700" size={48} /><p className="font-bold text-zinc-300">Todavía no hay estanterías configuradas.</p><p className="mt-1 text-sm text-zinc-500">Crea la primera y organiza sus niveles.</p></div> : <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{shelves.map((shelf) => <ShelfCard key={shelf.id} shelf={shelf} onEdit={() => openEdit(shelf)} onToggleFull={() => void quickUpdate(shelf, { llena_manual: !shelf.llena_manual })} onToggleActive={() => void quickUpdate(shelf, { activa: !shelf.activa })} />)}</div>}
    </div>
    {showForm && <ShelfFormModal form={form} setForm={setForm} editing={editing} saving={saving} error={formError} onSubmit={save} onClose={() => setShowForm(false)} />}
  </main>;
}

function ShelfCard({ shelf, onEdit, onToggleFull, onToggleActive }: { shelf: EstanteriaDesguace; onEdit: () => void; onToggleFull: () => void; onToggleActive: () => void }) {
  const barClass = shelf.llena ? "bg-red-500" : shelf.porcentaje_ocupacion >= 80 ? "bg-amber-500" : "bg-emerald-500";
  return <article className={`rounded-2xl border bg-zinc-900 p-5 ${shelf.llena ? "border-red-500/30" : "border-zinc-800"}`}>
    <div className="flex items-start justify-between gap-3"><div><div className="flex flex-wrap items-center gap-2"><p className="font-mono text-sm font-black text-amber-300">{shelf.codigo}</p><span className="rounded-full bg-cyan-500/10 px-2 py-0.5 text-xs font-bold text-cyan-300">{shelf.zona || "Sin zona"}</span></div><h2 className="text-xl font-bold text-white">{shelf.nombre}</h2><p className="mt-1 text-sm text-zinc-500">{shelf.descripcion || "Sin descripción"}</p></div>{shelf.llena ? <span className="rounded-full bg-red-500/10 px-3 py-1 text-xs font-bold text-red-300">LLENA</span> : !shelf.activa ? <span className="rounded-full bg-zinc-700 px-3 py-1 text-xs text-zinc-300">INACTIVA</span> : <CheckCircle2 className="text-emerald-400" />}</div>
    <div className="mt-4"><div className="mb-1 flex justify-between text-xs text-zinc-400"><span>{shelf.ocupados} ocupados</span><span>{shelf.disponibles} libres</span></div><div className="h-2 overflow-hidden rounded-full bg-zinc-800"><div className={`h-full ${barClass}`} style={{ width: `${Math.min(shelf.porcentaje_ocupacion, 100)}%` }} /></div><p className="mt-1 text-right text-xs text-zinc-500">{shelf.porcentaje_ocupacion}% · capacidad {shelf.capacidad_maxima}</p></div>
    <div className="mt-4 grid grid-cols-2 gap-3 text-sm"><Info label="Niveles" value={shelf.niveles} /><Info label="Huecos/nivel" value={shelf.huecos_por_nivel} /><Info label="Siguiente hueco" value={shelf.siguiente_ubicacion || "Ninguno"} mono /><Info label="Estado" value={shelf.llena_manual ? "Llena manual" : shelf.llena ? "Capacidad completa" : "Disponible"} /></div>
    <div className="mt-4 space-y-2 border-t border-zinc-800 pt-4">{shelf.reglas_nivel.length ? shelf.reglas_nivel.map((rule, index) => <div key={`${rule.nivel_desde}-${rule.nivel_hasta}-${index}`} className="flex items-center gap-2 rounded-lg bg-zinc-950 px-3 py-2 text-xs"><span className="shrink-0 font-bold text-cyan-300">Nivel {rule.nivel_desde}{rule.nivel_hasta !== rule.nivel_desde && `–${rule.nivel_hasta}`}</span><span className="truncate text-zinc-300">{rule.contenido || [...rule.categorias, ...rule.palabras_clave].join(", ")}</span></div>) : <p className="text-xs text-zinc-500">Regla general: {[...shelf.categorias, ...shelf.palabras_clave].join(", ") || "cualquier pieza"}</p>}</div>
    <div className="mt-5 flex flex-wrap gap-2"><Link href={`/almacen-desguace/estanterias/${shelf.id}`} className="inline-flex items-center gap-1 rounded-lg border border-amber-500/30 px-3 py-2 text-sm font-bold text-amber-300 hover:bg-amber-500/10"><Eye size={15} /> Ver ficha</Link><ShelfLabelButton shelf={shelf} compact /><button onClick={onEdit} className="inline-flex items-center gap-1 rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-800"><Edit3 size={15} /> Editar</button><button onClick={onToggleFull} className={`rounded-lg border px-3 py-2 text-sm ${shelf.llena_manual ? "border-emerald-500/30 text-emerald-300" : "border-red-500/30 text-red-300"}`}>{shelf.llena_manual ? "Marcar con espacio" : "Marcar llena"}</button><button onClick={onToggleActive} className="rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-400">{shelf.activa ? "Desactivar" : "Activar"}</button></div>
  </article>;
}

function ShelfFormModal({ form, setForm, editing, saving, error, onSubmit, onClose }: { form: ShelfForm; setForm: (form: ShelfForm) => void; editing: EstanteriaDesguace | null; saving: boolean; error: string; onSubmit: (event: FormEvent) => void; onClose: () => void }) {
  const input = "w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-white focus:border-amber-500 focus:outline-none";
  const update = (field: keyof ShelfForm, value: string | boolean) => setForm({ ...form, [field]: value });
  const updateDimensions = (field: "niveles" | "huecos_por_nivel", value: string) => {
    const oldTotal = Number(form.niveles) * Number(form.huecos_por_nivel);
    const next = { ...form, [field]: value };
    if (Number(form.capacidad_maxima) === oldTotal) next.capacidad_maxima = String(Number(next.niveles) * Number(next.huecos_por_nivel));
    setForm(next);
  };
  const updateRule = (index: number, field: keyof LevelRuleForm, value: string) => setForm({ ...form, reglas_nivel: form.reglas_nivel.map((rule, ruleIndex) => ruleIndex === index ? { ...rule, [field]: value } : rule) });
  const addRule = () => {
    const lastTo = Math.max(0, ...form.reglas_nivel.map((rule) => Number(rule.nivel_hasta) || 0));
    const nextLevel = Math.min(Number(form.niveles) || 1, lastTo + 1);
    setForm({ ...form, reglas_nivel: [...form.reglas_nivel, newRule(String(nextLevel), String(nextLevel))] });
  };
  return <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 p-0 backdrop-blur-sm sm:p-4 md:items-center">
    <form onSubmit={onSubmit} className="max-h-[96vh] w-full max-w-4xl overflow-y-auto rounded-t-2xl border border-zinc-700 bg-zinc-900 shadow-2xl sm:rounded-2xl">
      <div className="sticky top-0 z-20 flex items-center justify-between border-b border-zinc-800 bg-zinc-900/95 p-5 backdrop-blur"><div><h2 className="text-xl font-bold text-white">{editing ? `Editar ${editing.codigo}` : "Nueva estantería"}</h2><p className="text-sm text-zinc-400">Tres pasos: datos, tamaño y contenido por niveles.</p></div><button type="button" onClick={onClose} aria-label="Cerrar" className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-800"><X /></button></div>
      {error && <div role="alert" className="sticky top-[89px] z-10 mx-5 mt-4 flex gap-3 rounded-xl border border-red-400/40 bg-red-950 p-4 text-sm text-red-100 shadow-xl"><AlertTriangle className="shrink-0 text-red-400" size={20} /><div><p className="font-bold">No se ha podido guardar</p><p className="mt-1">{error}</p></div></div>}
      <div className="space-y-6 p-5">
        <FormSection number="1" title="Identifica la estantería" description="El código debe ser único, como E01, E02...">
          <div className="grid gap-4 md:grid-cols-2"><Label text="Código"><input required pattern="E[0-9]{2}" title="Usa E seguido de dos números, por ejemplo E01" value={form.codigo} onChange={(e) => update("codigo", e.target.value.toUpperCase())} placeholder="E01" className={input} /></Label><Label text="Nombre"><input required value={form.nombre} onChange={(e) => update("nombre", e.target.value)} placeholder="Estantería principal" className={input} /></Label><Label text="Zona o pasillo"><input required value={form.zona} onChange={(e) => update("zona", e.target.value)} placeholder="Zona A · Iluminación" className={input} /></Label><Label text="Orden dentro de la zona"><input type="number" min="0" max="9999" value={form.orden_plano} onChange={(e) => update("orden_plano", e.target.value)} className={input} /></Label><Label text="Descripción (opcional)" wide><textarea value={form.descripcion} onChange={(e) => update("descripcion", e.target.value)} rows={2} placeholder="Junto a la entrada, pared izquierda..." className={input} /></Label></div>
        </FormSection>
        <FormSection number="2" title="Indica su tamaño" description="Cada cruce de nivel y hueco será una ubicación disponible.">
          <div className="grid gap-4 sm:grid-cols-3"><Label text="Número de niveles"><input required type="number" min="1" max="99" value={form.niveles} onChange={(e) => updateDimensions("niveles", e.target.value)} className={input} /></Label><Label text="Huecos en cada nivel"><input required type="number" min="1" max="99" value={form.huecos_por_nivel} onChange={(e) => updateDimensions("huecos_por_nivel", e.target.value)} className={input} /></Label><Label text="Capacidad que se usará"><input required type="number" min="1" max={Math.max(1, Number(form.niveles) * Number(form.huecos_por_nivel))} value={form.capacidad_maxima} onChange={(e) => update("capacidad_maxima", e.target.value)} className={input} /></Label></div>
          <p className="mt-3 rounded-lg bg-zinc-950 p-3 text-sm text-zinc-400">Esta estantería tiene <strong className="text-white">{Number(form.niveles) * Number(form.huecos_por_nivel) || 0} huecos físicos</strong>.</p>
        </FormSection>
        <FormSection number="3" title="Reparte las piezas por niveles" description="Añade un grupo por cada tipo de pieza. Un nivel solo puede pertenecer a un grupo.">
          <div className="space-y-3">{form.reglas_nivel.map((rule, index) => <div key={index} className="rounded-xl border border-zinc-700 bg-zinc-950/60 p-4"><div className="mb-3 flex items-center justify-between"><p className="flex items-center gap-2 font-bold text-white"><Layers3 size={17} className="text-cyan-400" /> Grupo {index + 1}</p><button type="button" onClick={() => setForm({ ...form, reglas_nivel: form.reglas_nivel.filter((_, ruleIndex) => ruleIndex !== index) })} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-red-300 hover:bg-red-500/10"><Trash2 size={14} /> Quitar</button></div><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Label text="Desde nivel"><input required type="number" min="1" max={form.niveles} value={rule.nivel_desde} onChange={(e) => updateRule(index, "nivel_desde", e.target.value)} className={input} /></Label><Label text="Hasta nivel"><input required type="number" min="1" max={form.niveles} value={rule.nivel_hasta} onChange={(e) => updateRule(index, "nivel_hasta", e.target.value)} className={input} /></Label><Label text="¿Qué piezas van aquí?" wide><input required value={rule.contenido} onChange={(e) => updateRule(index, "contenido", e.target.value)} placeholder="Faros, pilotos" className={input} /></Label><Label text="Palabras adicionales (opcional)" wide><input value={rule.palabras_clave} onChange={(e) => updateRule(index, "palabras_clave", e.target.value)} placeholder="faro, piloto, antiniebla" className={input} /></Label></div></div>)}</div>
          <button type="button" onClick={addRule} className="mt-3 inline-flex items-center gap-2 rounded-xl border border-dashed border-cyan-500/50 px-4 py-2.5 text-sm font-bold text-cyan-300 hover:bg-cyan-500/10"><Plus size={17} /> Añadir otro grupo de niveles</button>
        </FormSection>
        <div className="flex flex-wrap gap-5 rounded-xl border border-zinc-800 bg-zinc-950 p-4"><label className="flex items-center gap-2 text-sm text-zinc-300"><input type="checkbox" checked={form.activa} onChange={(e) => update("activa", e.target.checked)} className="accent-amber-500" /> Estantería activa</label><label className="flex items-center gap-2 text-sm text-zinc-300"><input type="checkbox" checked={form.llena_manual} onChange={(e) => update("llena_manual", e.target.checked)} className="accent-red-500" /> Marcar temporalmente como llena</label></div>
      </div>
      <div className="sticky bottom-0 flex items-center justify-between gap-3 border-t border-zinc-800 bg-zinc-900/95 p-4 backdrop-blur"><button type="button" onClick={onClose} className="rounded-xl px-4 py-3 font-semibold text-zinc-400 hover:text-white">Cancelar</button><button disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-amber-500 px-5 py-3 font-bold text-zinc-950 hover:bg-amber-400 disabled:opacity-50">{saving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />} {editing ? "Guardar cambios" : "Crear estantería"}</button></div>
    </form>
  </div>;
}

function FormSection({ number, title, description, children }: { number: string; title: string; description: string; children: ReactNode }) { return <section><div className="mb-4 flex gap-3"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-500 font-black text-zinc-950">{number}</span><div><h3 className="font-bold text-white">{title}</h3><p className="text-sm text-zinc-500">{description}</p></div></div>{children}</section>; }
function Label({ text, wide, children }: { text: string; wide?: boolean; children: ReactNode }) { return <label className={wide ? "sm:col-span-2 lg:col-span-2" : ""}><span className="mb-1.5 block text-sm text-zinc-400">{text}</span>{children}</label>; }
function Info({ label, value, mono }: { label: string; value: ReactNode; mono?: boolean }) { return <div><p className="text-xs text-zinc-500">{label}</p><p className={`text-zinc-200 ${mono ? "font-mono text-xs" : "font-semibold"}`}>{value}</p></div>; }
